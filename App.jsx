
import React, { useEffect, useMemo, useState } from 'react'

const CYR_LABELS = ['А','Б','В','Г']
const LS_PREFIX = 'sestrinskoe-v2'
const LS = {
  ANSWERS: `${LS_PREFIX}-answers`,
  FAVS: `${LS_PREFIX}-favorites`,
  MISTAKES: `${LS_PREFIX}-mistakes`,
}

function saveLS(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)) }catch{} }
function loadLS(key, fallback){ try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }catch{ return fallback } }
function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a }

function parseQuestions(txt){
  const clean = txt.replace(/\r/g,'').trim()
  const chunks = clean.split(/\n(?=\s*\d+\.\s)/g)
  const items = []
  for(const raw of chunks){
    const block = raw.trim()
    if(!/^\d+\./.test(block)) continue
    let m = block.match(/^\s*(\d+)\.\s*(?:\[(.*?)\]\s*)?([\s\S]*?)\n(?=[АA]\))/)
    let number, qtext=''
    if(m){
      number = parseInt(m[1],10)
      qtext = (m[3]||'').replace(/\s+/g,' ').trim()
    }else{
      const m2 = block.match(/^\s*(\d+)\.\s*([\s\S]*?)\n(?=[АA]\))/)
      if(!m2) continue
      number = parseInt(m2[1],10)
      qtext = (m2[2]||'').replace(/\s+/g,' ').trim()
    }
    const options = []
    const optRe = /(^|\n)\s*([АAБВГ])\)\s*([\s\S]*?)(?=(\n\s*[АAБВГ]\)|$))/g
    let mm
    while((mm = optRe.exec(block))){
      const letter = mm[2] === 'A' ? 'А' : mm[2]
      const text = (mm[3]||'').replace(/\s+/g,' ').trim()
      if(text) options.push({letter, text})
    }
    if(options.length < 2) continue
    const correctText = (options.find(o=>o.letter==='А') || options[0]).text
    items.push({ number, qtext, options, correctText })
  }
  items.sort((a,b)=>a.number-b.number)
  return items
}

function splitBlocks(questions, size=100){
  const blocks=[]; for(let i=0;i<questions.length;i+=size) blocks.push(questions.slice(i,i+size)); return blocks
}

function Footer(){ return <div className="footer">© {new Date().getFullYear()} Тренажёр. Прогресс сохраняется локально.</div> }

function Home({total, blocksCount, onStartTrain, onStartExam, onStartFavs, onStartMistakes}){
  const [selectedBlock, setSelectedBlock] = useState('all')
  const [examMinutes, setExamMinutes] = useState(60)
  const [examSource, setExamSource] = useState('selected')
  return (
    <div className="container">
      <h1 style={{margin:'8px 0 16px'}}>Тренажёр‑тест «Сестринское дело»</h1>
      <div className="grid4" style={{marginBottom:16}}>
        <div className="tile" onClick={()=>onStartTrain(selectedBlock)}>
          <div className="tile-title">Тренировка</div>
          <div className="tile-desc">Выбор блока по 100, правильный виден сразу</div>
        </div>
        <div className="tile">
          <div className="tile-title">Экзамен</div>
          <div className="tile-desc">100 случайных вопросов, таймер</div>
          <div className="formrow">
            <label>Источник:</label>
            <select value={examSource} onChange={e=>setExamSource(e.target.value)}>
              <option value="selected">Из выбранного блока</option>
              <option value="all">Из всех вопросов</option>
            </select>
          </div>
          <div className="formrow">
            <label>Таймер (мин):</label>
            <input className="input" type="number" min="5" max="240" value={examMinutes} onChange={e=>setExamMinutes(parseInt(e.target.value||'60',10))}/>
          </div>
          <button className="btn primary" onClick={()=>onStartExam(selectedBlock, examSource, examMinutes)}>Начать экзамен</button>
        </div>
        <div className="tile" onClick={onStartFavs}>
          <div className="tile-title">Избранное</div>
          <div className="tile-desc">Повторить отмеченные ⭐ вопросы</div>
        </div>
        <div className="tile" onClick={onStartMistakes}>
          <div className="tile-title">Ошибки</div>
          <div className="tile-desc">Повторить вопросы, где были ошибки</div>
        </div>
      </div>
      <div className="card">
        <div className="row" style={{gap:12, alignItems:'center'}}>
          <div className="pill">Всего вопросов: {total}</div>
          <div className="pill">Блоков по 100: {blocksCount}</div>
          <div style={{minWidth:240}}>
            <label className="muted">Выбор блока (для тренировки/экзамена):</label>
            <select className="input" value={selectedBlock} onChange={e=>setSelectedBlock(e.target.value)}>
              <option value="all">Все вопросы</option>
              {Array.from({length: blocksCount}).map((_,i)=>(
                <option key={i} value={String(i)}>Блок {i+1}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

function Results({items, answers, onHome}){
  const stats = React.useMemo(()=>{
    const total = items.length
    const answered = items.filter(q=>answers[q.number]).length
    const correct = items.filter(q=>answers[q.number]===q.correctText).length
    const wrongList = items.filter(q=>answers[q.number] && answers[q.number]!==q.correctText)
    return { total, answered, correct, wrongList, pct: total? Math.round(correct/total*100):0 }
  }, [items, answers])
  function exportCSV(){
    const lines = ['number;question;selected;correct;is_correct']
    for(const q of items){
      const sel = answers[q.number] || ''
      const ok = sel ? (sel===q.correctText?'1':'0') : ''
      const esc = s => '\"'+(s||'').replaceAll('\"','\"\"')+'\"'
      lines.push([q.number, esc(q.qtext), esc(sel), esc(q.correctText), ok].join(';'))
    }
    const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='results.csv'; a.click(); URL.revokeObjectURL(url)
  }
  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between', marginBottom:12}}>
        <button className="btn" onClick={onHome}>← На главную</button>
        <div className="row">
          <div className="pill">Верно: {stats.correct}/{stats.total}</div>
          <div className="pill">{stats.pct}%</div>
          <button className="btn" onClick={exportCSV}>Экспорт .csv</button>
        </div>
      </div>
      <div className="card" style={{marginBottom:16}}>
        <h2 style={{marginTop:0}}>Ошибки</h2>
        {stats.wrongList.length===0 ? <div className="muted">Ошибок нет 🎉</div> : null}
        <div style={{display:'grid', gap:10}}>
          {stats.wrongList.map(q=>(
            <div key={q.number} className="card" style={{padding:12}}>
              <div className="muted">№ {q.number}</div>
              <div style={{margin:'6px 0 8px'}}>{q.qtext}</div>
              <div><b>Ваш ответ:</b> {answers[q.number]}</div>
              <div><b>Правильный:</b> {q.correctText}</div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}

function TestView({mode, items, onExit, onFinishExam}){
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState(()=>loadLS(LS.ANSWERS, {}))
  const [favs, setFavs] = useState(()=>loadLS(LS.FAVS, {}))
  const [mistakes, setMistakes] = useState(()=>loadLS(LS.MISTAKES, {}))

  const [startTs] = useState(()=>Math.floor(Date.now()/1000))
  const [now, setNow] = useState(()=>Math.floor(Date.now()/1000))
  const [timerMin] = useState(()=> (mode.type==='exam' ? mode.minutes : null))

  useEffect(()=>{
    if(mode.type!=='exam') return
    const t = setInterval(()=>setNow(Math.floor(Date.now()/1000)), 1000)
    return ()=>clearInterval(t)
  }, [mode.type])

  const remainingSec = useMemo(()=>{
    if(mode.type!=='exam') return null
    const elapsed = now - startTs
    return Math.max(0, (timerMin*60) - elapsed)
  }, [now, startTs, timerMin, mode.type])

  useEffect(()=>{
    if(mode.type==='exam' && remainingSec===0){
      onFinishExam({items, answers})
    }
  }, [remainingSec])

  const view = items[idx] || null
  const progress = useMemo(()=>{
    const total = items.length || 1
    const answered = items.filter(q=>answers[q.number]).length
    const correct = items.filter(q=>answers[q.number] && answers[q.number]===q.correctText).length
    return { total, answered, correct, pct: Math.round(answered/total*100) }
  }, [items, answers])

  function pick(q, text){
    const na = { ...answers, [q.number]: text }
    setAnswers(na); saveLS(LS.ANSWERS, na)
    if(text !== q.correctText){
      const nm = { ...mistakes, [q.number]: true }
      setMistakes(nm); saveLS(LS.MISTAKES, nm)
    }
  }
  function toggleFav(q){
    const nf = { ...favs }
    if(nf[q.number]) delete nf[q.number]; else nf[q.number] = true
    setFavs(nf); saveLS(LS.FAVS, nf)
  }

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between', marginBottom:8}}>
        <button className="btn" onClick={onExit}>← На главную</button>
        <div className="row" style={{gap:8, alignItems:'center'}}>
          <div className="pill">Режим: {mode.title}</div>
          <div className="pill">Отвечено: {progress.answered}/{progress.total}</div>
          <div className="pill">{progress.pct}%</div>
          {mode.type==='exam' ? (
            <div className={'pill ' + (remainingSec<=60?'alert':'')} title="Оставшееся время">
              ⏱ {String(Math.floor(remainingSec/60)).padStart(2,'0')}:{String(remainingSec%60).padStart(2,'0')}
            </div>
          ):null}
          {mode.type==='exam' ? <button className="btn primary" onClick={()=>onFinishExam({items, answers})}>Завершить экзамен</button> : null}
        </div>
      </div>

      {view ? (
        <div className="grid">
          <div className="card">
            <div className="row" style={{justifyContent:'space-between'}}>
              <div>
                <div className="muted">№ {view.number}</div>
                <h2 style={{margin:'6px 0 12px'}}>{view.qtext}</h2>
              </div>
              <div className="fav" onClick={()=>toggleFav(view)}>{ (favs[view.number]) ? '⭐' : '☆' }</div>
            </div>

            <div className="options">
              {shuffle(view.options.map(o=>o.text)).slice(0,4).map((text,i)=>{
                const chosen = answers[view.number]
                const isCorrect = text === view.correctText
                let cls = 'opt'
                if(mode.type==='train' && chosen){
                  if(isCorrect) cls += ' correct'
                  else if(text===chosen) cls += ' wrong'
                }
                if(mode.type!=='train' && chosen){
                  if(text===chosen) cls += ' chosen'
                }
                return (
                  <div key={i} className={cls} onClick={()=>pick(view, text)}>
                    <div><span className="label">{CYR_LABELS[i]||'?'})</span> {text}</div>
                    {(mode.type==='train' && chosen && isCorrect) ? <div className="muted">Правильный ответ</div> : null}
                  </div>
                )
              })}
            </div>

            {(mode.type!=='train' && answers[view.number]) ? (
              <div className="muted" style={{marginTop:8}}>Вы выбрали: {answers[view.number]}</div>
            ) : null}

            <div className="row" style={{marginTop:12, justifyContent:'space-between'}}>
              <button className="btn" onClick={()=>setIdx(i=>Math.max(0,i-1))}>← Предыдущий</button>
              <div className="muted">{idx+1} / {items.length}</div>
              <button className="btn" onClick={()=>setIdx(i=>Math.min(items.length-1,i+1))}>Следующий →</button>
            </div>
          </div>

          <div className="card">
            <h3 style={{marginTop:0}}>Список</h3>
            <div className="muted" style={{marginBottom:8}}>Кликни, чтобы перейти</div>
            <div style={{maxHeight:'65vh', overflow:'auto', display:'grid', gap:8}}>
              {items.map((q,i)=>{
                const chosen = answers[q.number]
                const active = i===idx
                return (
                  <div key={q.number} className={'itemline '+(active?'active':'')} onClick={()=>{}} onDoubleClick={()=>{}}>
                    <div className="row" style={{justifyContent:'space-between', width:'100%'}} onClick={()=>{}}>
                      <div style={{display:'flex', gap:8, alignItems:'center', cursor:'pointer'}} onClick={()=>{}}>
                        <span className="badge">{q.number}</span>
                        <div style={{maxWidth:520, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={q.qtext}
                          onClick={()=>{}}>{q.qtext}</div>
                      </div>
                      <div onClick={()=>{}}>
                        {chosen ? (chosen===q.correctText ? '✅' : '❌') : '•'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="card"><div className="muted">Нет вопросов для отображения.</div></div>
      )}

      <Footer />
    </div>
  )
}

export default function App(){
  const [raw, setRaw] = useState('')
  const [questions, setQuestions] = useState([])
  const [phase, setPhase] = useState('home') // home | test | results
  const [mode, setMode] = useState(null)     // {type:'train'|'exam'|'favorites'|'mistakes', title, minutes?}
  const [items, setItems] = useState([])
  const [examSnapshot, setExamSnapshot] = useState(null) // {items, answers}

  useEffect(()=>{
    fetch('/public/questions.txt'.replace('/public','/public'))
      .then(r=>r.ok?r.text():'')
      .then(setRaw)
      .catch(()=>{})
  },[])

  useEffect(()=>{
    if(!raw) return
    setQuestions(parseQuestions(raw))
  }, [raw])

  const blocks = useMemo(()=>splitBlocks(questions, 100), [questions])

  function resolvePool(selectedBlock){
    if(selectedBlock==='all') return questions
    const idx = parseInt(selectedBlock,10)
    if(!isNaN(idx) && blocks[idx]) return blocks[idx]
    return questions
  }

  function startTrain(selectedBlock){
    const pool = resolvePool(selectedBlock)
    setMode({type:'train', title:'Тренировка'})
    setItems(pool)
    setPhase('test')
  }
  function startExam(selectedBlock, source, minutes){
    const pool = (source==='all') ? questions : resolvePool(selectedBlock)
    const pick = shuffle(pool).slice(0, Math.min(100, pool.length))
    setMode({type:'exam', title:'Экзамен', minutes})
    setItems(pick)
    setPhase('test')
  }
  function startFavs(){
    const favs = loadLS(LS.FAVS, {})
    const set = new Set(Object.keys(favs).map(n=>parseInt(n,10)))
    const pool = questions.filter(q=>set.has(q.number))
    setMode({type:'favorites', title:'Избранное'})
    setItems(pool)
    setPhase('test')
  }
  function startMistakes(){
    const ms = loadLS(LS.MISTAKES, {})
    const set = new Set(Object.keys(ms).map(n=>parseInt(n,10)))
    const pool = questions.filter(q=>set.has(q.number))
    setMode({type:'mistakes', title:'Ошибки'})
    setItems(pool)
    setPhase('test')
  }

  function finishExam({items, answers}){
    setExamSnapshot({items, answers})
    setPhase('results')
  }

  return (
    <>
      {phase==='home' ? (
        <Home
          total={questions.length}
          blocksCount={blocks.length}
          onStartTrain={startTrain}
          onStartExam={startExam}
          onStartFavs={startFavs}
          onStartMistakes={startMistakes}
        />
      ) : null}

      {phase==='test' ? (
        <TestView
          mode={mode}
          items={items}
          onExit={()=>setPhase('home')}
          onFinishExam={finishExam}
        />
      ) : null}

      {phase==='results' ? (
        <Results
          items={examSnapshot?.items || []}
          answers={examSnapshot?.answers || {}}
          onHome={()=>setPhase('home')}
        />
      ) : null}
    </>
  )
}
