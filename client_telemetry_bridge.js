(function(){
  const s={t0:Date.now(),subs:0,edits:0,retries:0,hints:0,exps:0,corr:0,tot:0},b=window.emitEvent;
  const has=(name,word)=>new RegExp(`(^|_)${word}($|_)`).test(name);
  window.emitEvent=function(e,p={}){
    const n=String(e).toLowerCase();
    if(/submit|code_executed|example_run/.test(n))s.subs++;if(has(n,'code_changed'))s.edits++;if(/retry/.test(n))s.retries++;if(/hint/.test(n))s.hints++;if(/experiment|example/.test(n))s.exps++;if(has(n,'correct'))s.corr++,s.tot++;else if(has(n,'incorrect'))s.tot++;
    return b?b.apply(this,arguments):null;
  };
  window.flushTelemetry=async function(){
    const d=Math.max(1,(Date.now()-s.t0)/1000),c=document.querySelector('#code-editor-body,#code-editor');
    const body={total_time_seconds:d,code_submissions:s.subs,submission_frequency_per_min:+(s.subs/(d/60)).toFixed(2),code_structure_changes:s.edits,retries:s.retries,hint_requests:s.hints,experiments_started:s.exps,question_level:(window.state?.activeDifficulty||'beginner'),accuracy_rate:s.tot?+(s.corr/s.tot).toFixed(2):1,active_code:c?.innerText||'',lesson_context:document.title};
    const apiBase=window.ADAPTIVE_API_URL||window.location.origin;
    return fetch(`${apiBase}/api/telemetry`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(response=>{if(!response.ok)throw new Error(`Telemetry request failed (${response.status})`);return response.json();})
      .catch(error=>{console.warn('[Helix telemetry]',error.message);return null;});
  };
  setInterval(window.flushTelemetry,25000);
})();