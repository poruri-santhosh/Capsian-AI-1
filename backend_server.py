"""FastAPI service for telemetry, learner state, classification, and Gemini guidance."""

import json
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional

import joblib
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
MODEL_PATH = BASE_DIR / "learner_classifier.pkl"
MODEL_ARTIFACT = joblib.load(MODEL_PATH) if MODEL_PATH.exists() else None
LEVEL_MAP = {"beginner": 1, "intermediate": 2, "advanced": 3}
FEATURE_COLUMNS = [
    "total_time_seconds", "code_submissions", "submission_frequency_per_min",
    "code_structure_changes", "retries", "hint_requests", "experiments_started",
    "question_level_numeric", "accuracy_rate",
]

app = FastAPI(title="Helix Adaptive Learning Core Engine")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

default_api_key = (os.getenv("GEMINI_API_KEY") or os.getenv("API_KEY") or "").strip()
gemini_client = genai.Client(api_key=default_api_key) if default_api_key else None


def get_gemini_client(custom_api_key: Optional[str] = None) -> Optional[genai.Client]:
    """Retrieve Gemini client using custom provided key or fallback to environment."""
    key = (custom_api_key or os.getenv("GEMINI_API_KEY") or os.getenv("API_KEY") or "").strip()
    if not key:
        return None
    try:
        return genai.Client(api_key=key)
    except Exception:
        return None


class TelemetryPayload(BaseModel):
    total_time_seconds: float = Field(..., ge=0)
    code_submissions: int = Field(..., ge=0)
    submission_frequency_per_min: float = Field(..., ge=0)
    code_structure_changes: int = Field(..., ge=0)
    retries: int = Field(..., ge=0)
    hint_requests: int = Field(..., ge=0)
    experiments_started: int = Field(..., ge=0)
    question_level: str = Field(default="beginner")
    accuracy_rate: float = Field(..., ge=0, le=1)
    active_code: Optional[str] = Field(default="")
    lesson_context: Optional[str] = Field(default="Variables & Expressions")


class GuidancePayload(BaseModel):
    learner_type: str = Field(default="Manual Learner")
    current_user_level: str = Field(default="Beginner")
    active_code: Optional[str] = Field(default="")
    lesson_context: Optional[str] = Field(default="Variables & Expressions")


class ChatPayload(BaseModel):
    message: str = Field(..., description="Student question or query")
    lesson_id: int = Field(default=1, description="Active lesson ID (1-10)")
    lesson_context: str = Field(default="Variables & Expressions")
    active_code: Optional[str] = Field(default="")
    current_user_level: str = Field(default="Beginner")
    learner_type: str = Field(default="Manual Learner")
    chat_history: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    api_key: Optional[str] = Field(default=None)
    accuracy_rate: Optional[float] = Field(default=0.8)
    total_time_seconds: Optional[float] = Field(default=60.0)
    retries: Optional[int] = Field(default=0)
    hint_requests: Optional[int] = Field(default=0)
    code_submissions: Optional[int] = Field(default=1)
    experiments_started: Optional[int] = Field(default=0)


class VerifyKeyPayload(BaseModel):
    api_key: str = Field(..., min_length=5)


def calculate_user_competency(accuracy: float, time_spent: float, retries: int) -> str:
    score = 3 if accuracy >= 0.85 else 2 if accuracy >= 0.60 else 1
    score += 2 if time_spent < 90 else 1 if time_spent <= 300 else 0
    score += 2 if retries == 0 else 1 if retries <= 2 else 0
    return "Advanced" if score >= 6 else "Intermediate" if score >= 4 else "Beginner"


def predict_learner_type(payload: TelemetryPayload) -> str:
    if MODEL_ARTIFACT is None:
        return "Experimental Learner" if (
            payload.submission_frequency_per_min > 2 or payload.experiments_started >= 2
        ) else "Manual Learner"

    values = {
        "total_time_seconds": payload.total_time_seconds,
        "code_submissions": payload.code_submissions,
        "submission_frequency_per_min": payload.submission_frequency_per_min,
        "code_structure_changes": payload.code_structure_changes,
        "retries": payload.retries,
        "hint_requests": payload.hint_requests,
        "experiments_started": payload.experiments_started,
        "question_level_numeric": LEVEL_MAP.get(payload.question_level.lower(), 1),
        "accuracy_rate": payload.accuracy_rate,
    }
    frame = pd.DataFrame([[values[column] for column in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)
    return str(MODEL_ARTIFACT["model"].predict(frame)[0])


def generate_heuristic_guidance(state: Dict[str, Any], code: str, context: str) -> str:
    learner_type = state.get("learner_type", "Manual Learner")
    level = state.get("current_user_level", "Beginner")
    clean_code = (code or "").strip()
    
    if "swap" in context.lower() or "challenge" in context.lower():
        if "temp" not in clean_code and "[a" not in clean_code:
            return (
                f"[{learner_type} • {level}] To swap two variables without losing values, "
                "store one in a temporary variable first (e.g., let temp = a; a = b; b = temp;), "
                "or use array destructuring: [a, b] = [b, a]."
            )
        return f"[{learner_type} • {level}] Great approach on the swap logic! Test it by printing console.log(a, b) to ensure a is 2 and b is 1."

    if "reassign" in context.lower() or "score" in context.lower():
        if "=" not in clean_code:
            return f"[{learner_type} • {level}] Remember to declare your variable with let (e.g. let score = 0;) and then update it with score = 100;."
        return f"[{learner_type} • {level}] You're on track! Make sure to log the variable using console.log(score) so your program outputs 100."

    if not clean_code or clean_code == "// No code written yet":
        if learner_type == "Experimental Learner":
            return f"[{learner_type} • {level}] Jump right in! Try writing a small declaration: let x = 10; and run it to see how the engine responds."
        return f"[{learner_type} • {level}] Start by declaring a variable using the 'let' keyword, give it a descriptive name, and assign a value with '='."

    if "console.log" not in clean_code:
        return f"[{learner_type} • {level}] Your variable declaration looks solid. Add console.log(...) to print and verify your variables in the output console."
        
    return f"[{learner_type} • {level}] Code structure looks clean for '{context}'. Run your code to inspect output and verify against the lesson objective."


def generate_gemini_guidance(state: Dict[str, Any], code: str, context: str) -> str:
    if gemini_client is not None:
        experimental = state.get("learner_type") == "Experimental Learner"
        pedagogy = (
            "Use quick code sandboxes, interactive debugging, and fast test cases. Keep explanations punchy."
            if experimental else
            "Use step-by-step structural scaffolding, syntax explanations, and guided examples."
        )
        system_instruction = (
            "You are Helix AI, an adaptive programming coach. "
            f"The learner is a {state.get('learner_type', 'Manual Learner')} at {state.get('current_user_level', 'Beginner')} level. "
            f"{pedagogy} Stay concise and focus on the current lesson: {context}."
        )
        prompt = f"Learner state JSON:\n{state}\n\nCurrent code:\n```javascript\n{code or '// No code written yet'}\n```\nGive the next useful learning action."
        try:
            response = gemini_client.models.generate_content(
                model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.4,
                    max_output_tokens=500,
                ),
            )
            if response.text:
                return response.text
        except Exception:
            pass

    return generate_heuristic_guidance(state, code, context)


@app.get("/api/health")
async def health() -> Dict[str, Any]:
    return {"status": "ok", "model_loaded": MODEL_ARTIFACT is not None, "gemini_enabled": gemini_client is not None}


@app.get("/", include_in_schema=False)
async def home() -> FileResponse:
    return FileResponse(BASE_DIR / "qwen_main.html")


@app.get("/learn", include_in_schema=False)
async def learn_page() -> FileResponse:
    return FileResponse(BASE_DIR / "qwen_learn.html")


@app.get("/practice", include_in_schema=False)
async def practice_page() -> FileResponse:
    return FileResponse(BASE_DIR / "qwen_practice.html")


@app.post("/api/telemetry")
async def collect_telemetry(payload: TelemetryPayload) -> Dict[str, Any]:
    learner_type = predict_learner_type(payload)
    state = {
        "current_user_level": calculate_user_competency(
            payload.accuracy_rate, payload.total_time_seconds, payload.retries
        ),
        "learner_type": learner_type,
        "question_difficulty": payload.question_level.strip().capitalize(),
        "metrics": payload.model_dump(exclude={"active_code", "lesson_context"})
        if hasattr(payload, "model_dump") else payload.dict(exclude={"active_code", "lesson_context"}),
    }
    return {
        "status": "success",
        "state": state,
        "ai_guidance": generate_gemini_guidance(
            state, payload.active_code or "", payload.lesson_context or "Variables & Expressions"
        ),
    }


@app.post("/api/guidance")
async def guidance(payload: GuidancePayload) -> Dict[str, str]:
    state = {
        "current_user_level": payload.current_user_level,
        "learner_type": payload.learner_type,
    }
    return {
        "status": "success",
        "ai_guidance": generate_gemini_guidance(
            state,
            payload.active_code or "",
            payload.lesson_context or "Variables & Expressions",
        ),
    }


def extract_chat_and_assessment(raw_text: str, default_lesson_id: int = 1) -> tuple[str, Dict[str, Any]]:
    """Extract student explanation and structured JSON assessment from model output."""
    clean_text = raw_text.strip()
    explanation_match = re.search(r"<EXPLANATION>(.*?)</EXPLANATION>", clean_text, re.DOTALL | re.IGNORECASE)
    assessment_match = re.search(r"<ASSESSMENT>(.*?)</ASSESSMENT>", clean_text, re.DOTALL | re.IGNORECASE)

    explanation = explanation_match.group(1).strip() if explanation_match else ""
    assessment_json: Dict[str, Any] = {}

    if assessment_match:
        try:
            assessment_json = json.loads(assessment_match.group(1).strip())
        except Exception:
            json_blob = re.search(r"\{[\s\S]*\}", assessment_match.group(1))
            if json_blob:
                try:
                    assessment_json = json.loads(json_blob.group(0))
                except Exception:
                    pass

    if not explanation:
        if "<ASSESSMENT>" in clean_text:
            explanation = clean_text.split("<ASSESSMENT>")[0].replace("<EXPLANATION>", "").replace("</EXPLANATION>", "").strip()
        else:
            json_blocks = re.findall(r"```json([\s\S]*?)```", clean_text)
            if json_blocks:
                try:
                    assessment_json = json.loads(json_blocks[-1].strip())
                    explanation = re.sub(r"```json[\s\S]*?```", "", clean_text).strip()
                except Exception:
                    explanation = clean_text
            else:
                json_blob = re.search(r"\{[\s\S]*\"question_complexity\"[\s\S]*\}", clean_text)
                if json_blob:
                    try:
                        assessment_json = json.loads(json_blob.group(0))
                        explanation = clean_text.replace(json_blob.group(0), "").strip()
                    except Exception:
                        explanation = clean_text
                else:
                    explanation = clean_text

    comp = str(assessment_json.get("question_complexity", "Intermediate")).capitalize()
    eval_lvl = str(assessment_json.get("evaluated_level", "Intermediate")).capitalize()
    align = str(assessment_json.get("level_alignment", "Matches current level"))
    state_str = str(assessment_json.get("understanding_state", "on_track")).lower()
    next_id_val = assessment_json.get("recommended_next_lesson_id")
    try:
        next_id = int(next_id_val) if next_id_val is not None else min(10, default_lesson_id + 1)
    except Exception:
        next_id = min(10, default_lesson_id + 1)
    diff = str(assessment_json.get("recommended_difficulty", eval_lvl)).capitalize()
    rationale = str(assessment_json.get("personalization_rationale", "Continue your personalized learning journey."))

    assessment = {
        "question_complexity": comp if comp in ["Beginner", "Intermediate", "Advanced"] else "Intermediate",
        "evaluated_level": eval_lvl if eval_lvl in ["Beginner", "Intermediate", "Advanced"] else "Intermediate",
        "level_alignment": align,
        "understanding_state": state_str if state_str in ["struggling", "on_track", "mastery"] else "on_track",
        "recommended_next_lesson_id": max(1, min(10, next_id)),
        "recommended_difficulty": diff if diff in ["Beginner", "Intermediate", "Advanced"] else "Intermediate",
        "personalization_rationale": rationale,
    }
    return explanation, assessment


def generate_heuristic_chat_and_assessment(payload: ChatPayload, state: Dict[str, Any]) -> tuple[str, Dict[str, Any]]:
    """Intelligent pedagogical fallback when Gemini key is missing or offline."""
    msg = payload.message.lower()
    lesson_id = payload.lesson_id or 1
    code = (payload.active_code or "").strip()
    curr_level = state.get("current_user_level", "Beginner")

    if any(w in msg for w in ["destructur", "swap", "temp", "algorithm", "memory", "scope", "hoisting", "closure", "performance", "immutable"]):
        complexity = "Advanced"
        eval_level = "Advanced"
        alignment = "Exceeds current level"
        understanding = "mastery"
        next_id = 9 if lesson_id != 9 else 10
        rationale = f"Your inquiry about advanced JavaScript patterns ({complexity} level) shows strong mastery. Accelerating directly to Lesson {next_id} Mini Challenge!"
        reply = (
            "**Helix Tutor:** That's a great high-level question! In JavaScript, variable swapping can be done with a temporary variable "
            "(`let temp = a; a = b; b = temp;`) or modern ES6 array destructuring: `[a, b] = [b, a];`.\n\n"
            "Because you're asking advanced questions that exceed this problem's standard scope, I've adjusted your path to jump right to **Lesson 9: Mini Challenge**!"
        )
    elif any(w in msg for w in ["why", "error", "wrong", "fail", "stuck", "bug", "not working", "help", "confused", "don't understand", "problem", "broken"]):
        complexity = "Beginner"
        eval_level = "Beginner"
        alignment = "Below current level" if curr_level != "Beginner" else "Matches current level"
        understanding = "struggling"
        next_id = max(1, lesson_id - 1) if lesson_id in [5, 7, 8, 9] else (2 if lesson_id == 1 else lesson_id)
        rationale = f"To solidify core principles after running into a hurdle, we recommend reinforcing fundamental syntax in Lesson {next_id}."

        hint = ""
        if "score" in payload.lesson_context.lower() or lesson_id == 5:
            hint = "Remember to declare `let score = 0;`, then update with `score = 100;`, and finish with `console.log(score);`."
        elif "swap" in payload.lesson_context.lower() or lesson_id == 9:
            hint = "You need a third variable (e.g. `let temp = a; a = b; b = temp;`) so neither value gets overwritten before being saved."
        elif not code or code == "// No code written yet":
            hint = "Start by writing a variable declaration using the `let` keyword, like `let x = 10;`."
        else:
            hint = "Make sure variable names follow the rules (no starting digits, no hyphens, and no reserved keywords)."

        reply = (
            f"**Helix Tutor:** Let's work through this together!\n\n"
            f"💡 **Key Tip:** {hint}\n\n"
            f"Variables store values in memory. When you reassign, you don't use the `let` keyword again—just `variableName = newValue;`.\n\n"
            f"I have tuned your path to reinforce **Lesson {next_id}** next to give you extra practice!"
        )
    elif any(w in msg for w in ["explain", "what is", "how do", "meaning", "difference", "clarify", "example", "tell me"]):
        complexity = "Intermediate"
        eval_level = "Intermediate"
        alignment = "Matches current level"
        understanding = "on_track"
        next_id = min(10, lesson_id + 1)
        rationale = f"Your conceptual question aligns well with your current learning level. Proceeding to Lesson {next_id} for sequential progress."
        reply = (
            f"**Helix Tutor:** Good question! In **{payload.lesson_context}**, variables give names to memory locations so programs can read and write data dynamically. "
            f"`let` allows changing values later, while `const` ensures the identifier cannot be reassigned.\n\n"
            f"Give it a try in the editor! Up next on your personalized path is **Lesson {next_id}**."
        )
    else:
        complexity = "Intermediate"
        eval_level = curr_level
        alignment = "Matches current level"
        understanding = "on_track"
        next_id = min(10, lesson_id + 1)
        rationale = f"Steady progress detected. Advancing to Lesson {next_id}."
        reply = (
            f"**Helix Tutor:** You are currently on **Lesson {lesson_id}: {payload.lesson_context}**. "
            f"Try experimenting with different values in the code editor, and feel free to ask questions about syntax or outputs! "
            f"Next recommended step: **Lesson {next_id}**."
        )

    assessment = {
        "question_complexity": complexity,
        "evaluated_level": eval_level,
        "level_alignment": alignment,
        "understanding_state": understanding,
        "recommended_next_lesson_id": next_id,
        "recommended_difficulty": eval_level,
        "personalization_rationale": rationale,
    }
    return reply, assessment


@app.post("/api/verify_key")
async def verify_key(payload: VerifyKeyPayload) -> Dict[str, Any]:
    """Validate user-provided Gemini API key."""
    client = get_gemini_client(payload.api_key)
    if not client:
        return {"valid": False, "message": "Failed to initialize client with the provided key."}
    try:
        res = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            contents="Ping test. Respond with OK.",
            config=types.GenerateContentConfig(max_output_tokens=10),
        )
        if res and res.text:
            return {"valid": True, "message": "Gemini API key is verified and active!"}
        return {"valid": False, "message": "Received empty response from Gemini API."}
    except Exception as e:
        return {"valid": False, "message": f"Verification failed: {str(e)}"}


@app.post("/api/chat")
async def chat_tutor(payload: ChatPayload) -> Dict[str, Any]:
    """Interactive question chatbot with Gemini level evaluation and ML adaptive personalization."""
    curr_competency = payload.current_user_level or "Beginner"
    curr_learner_type = payload.learner_type or "Manual Learner"
    temp_state = {
        "current_user_level": curr_competency,
        "learner_type": curr_learner_type,
        "lesson_id": payload.lesson_id,
        "lesson_context": payload.lesson_context,
    }

    client = get_gemini_client(payload.api_key)
    reply = ""
    assessment = None
    is_gemini = False

    if client is not None:
        try:
            history_prompt = ""
            if payload.chat_history:
                recent = payload.chat_history[-4:]
                for h in recent:
                    sender = "Student" if h.get("role") == "user" else "Tutor"
                    history_prompt += f"{sender}: {h.get('content', '')}\n"

            system_instruction = (
                "You are Helix AI, an expert adaptive programming tutor and pedagogical evaluator embedded in an interactive coding platform.\n"
                f"Current Lesson ID: {payload.lesson_id}\n"
                f"Lesson Context: {payload.lesson_context}\n"
                f"Student's Current Competency Level: {curr_competency}\n"
                f"Student's Learner Style: {curr_learner_type}\n"
                f"Student's Active Code:\n```{payload.active_code or '// No code written yet'}```\n\n"
                "OBJECTIVES:\n"
                "1. Answer the student's question clearly, encouragingly, and pedagogically.\n"
                "   - If 'Experimental Learner', be concise, suggest tests/code variations, and keep it fast-paced.\n"
                "   - If 'Manual Learner', offer structured explanations and step-by-step clarity.\n"
                "2. Evaluate the student's question complexity and understanding depth.\n"
                "   - question_complexity: 'Beginner' (basic syntax/typos), 'Intermediate' (mechanics/reassignment/scope), or 'Advanced' (destructuring/memory/edge cases).\n"
                "   - evaluated_level: 'Beginner' | 'Intermediate' | 'Advanced'.\n"
                "   - level_alignment: 'Below current level' | 'Matches current level' | 'Exceeds current level'.\n"
                "   - understanding_state: 'struggling' (needs scaffolding/review) | 'on_track' (steady progress) | 'mastery' (grasping ahead of curriculum).\n"
                "   - recommended_next_lesson_id: An integer (1 to 10) representing the most personalized next lesson:\n"
                "       1: Introduction, 2: What is a Variable?, 3: Declaring Variables, 4: Naming Rules,\n"
                "       5: Reassigning Values, 6: let/const/var, 7: Try It Yourself, 8: Common Errors,\n"
                "       9: Mini Challenge (Swap), 10: Summary.\n"
                "       * Struggling -> scaffold back (e.g. 1, 2, 4).\n"
                "       * On Track -> sequential step (current_id + 1).\n"
                "       * Mastery -> accelerate forward (e.g. 7, 8, 9).\n"
                "   - recommended_difficulty: 'Beginner' | 'Intermediate' | 'Advanced'.\n"
                "   - personalization_rationale: 1-2 sentence pedagogical rationale.\n\n"
                "STRICT OUTPUT FORMAT:\n"
                "<EXPLANATION>\n"
                "(Your friendly conversational explanation here, supporting markdown code blocks)\n"
                "</EXPLANATION>\n"
                "<ASSESSMENT>\n"
                "{\n"
                '  "question_complexity": "Beginner|Intermediate|Advanced",\n'
                '  "evaluated_level": "Beginner|Intermediate|Advanced",\n'
                '  "level_alignment": "Below current level|Matches current level|Exceeds current level",\n'
                '  "understanding_state": "struggling|on_track|mastery",\n'
                '  "recommended_next_lesson_id": 1,\n'
                '  "recommended_difficulty": "Beginner|Intermediate|Advanced",\n'
                '  "personalization_rationale": "..."\n'
                "}\n"
                "</ASSESSMENT>"
            )

            prompt_content = f"{history_prompt}Student: {payload.message}\nActive Code:\n{payload.active_code or '// None'}"
            response = client.models.generate_content(
                model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
                contents=prompt_content,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.4,
                    max_output_tokens=750,
                ),
            )
            if response and response.text:
                reply, assessment = extract_chat_and_assessment(response.text, payload.lesson_id or 1)
                is_gemini = True
        except Exception:
            pass

    if not reply or not assessment:
        reply, assessment = generate_heuristic_chat_and_assessment(payload, temp_state)

    # Feed Gemini's evaluation into Machine Learning Model & Competency Engine
    eval_level = assessment.get("evaluated_level", "Beginner")
    level_numeric = LEVEL_MAP.get(eval_level.lower(), 1)

    telem = TelemetryPayload(
        total_time_seconds=payload.total_time_seconds or 60.0,
        code_submissions=payload.code_submissions or 1,
        submission_frequency_per_min=max(0.1, (payload.code_submissions or 1) / max(0.5, ((payload.total_time_seconds or 60.0) / 60.0))),
        code_structure_changes=1,
        retries=payload.retries or 0,
        hint_requests=(payload.hint_requests or 0) + 1,
        experiments_started=(payload.experiments_started or 0) + (1 if assessment.get("understanding_state") == "mastery" else 0),
        question_level=eval_level.lower(),
        accuracy_rate=payload.accuracy_rate if payload.accuracy_rate is not None else 0.8,
        active_code=payload.active_code or "",
        lesson_context=payload.lesson_context or "Variables & Expressions",
    )

    predicted_learner = predict_learner_type(telem)
    computed_competency = calculate_user_competency(telem.accuracy_rate, telem.total_time_seconds, telem.retries)

    if assessment.get("understanding_state") == "mastery" and computed_competency == "Beginner":
        computed_competency = "Intermediate"

    updated_state = {
        "current_user_level": computed_competency,
        "learner_type": predicted_learner,
        "question_difficulty": assessment.get("recommended_difficulty", eval_level),
        "question_level_numeric": level_numeric,
        "evaluated_level": eval_level,
        "understanding_state": assessment.get("understanding_state", "on_track"),
        "recommended_next_lesson_id": assessment.get("recommended_next_lesson_id", min(10, (payload.lesson_id or 1) + 1)),
        "personalization_rationale": assessment.get("personalization_rationale", "Personalized progression based on inquiry."),
        "source": "gemini" if is_gemini else "heuristic",
    }

    return {
        "status": "success",
        "reply": reply,
        "assessment": assessment,
        "state": updated_state,
    }


app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend_server:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)