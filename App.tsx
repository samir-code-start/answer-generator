
import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Trash2, Check, FileText, Download, ListChecks, 
  Sparkles, X, Wand2, Plus, PenTool, Edit3, Settings, 
  Clock, ChevronDown, RefreshCw, Sun, Moon, Zap, Clipboard, 
  ClipboardList, ArrowRight, MousePointer2, Type as FontIcon,
  History
} from 'lucide-react';
import { MarksWeightage, AnswerStyle, DefaultAnswerStyle, GeneratedAnswer, CustomStyle } from './types';
import { generateSPPUAnswer, suggestSPPUQuestions, SYSTEM_INSTRUCTION } from './services/geminiService';
import { jsPDF } from 'jspdf';

const App: React.FC = () => {
  const [questionInput, setQuestionInput] = useState('');
  const [marks, setMarks] = useState<MarksWeightage>(MarksWeightage.FIVE);
  const [style, setStyle] = useState<AnswerStyle>(DefaultAnswerStyle.MODEL_ANSWER);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showSuggestInput, setShowSuggestInput] = useState(false);
  const [showAddStyleModal, setShowAddStyleModal] = useState(false);
  const [showManageStylesModal, setShowManageStylesModal] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [newStylePrompt, setNewStylePrompt] = useState('');
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  const [customStyles, setCustomStyles] = useState<CustomStyle[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState<GeneratedAnswer | null>(null);
  const [history, setHistory] = useState<GeneratedAnswer[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const marksSelectRef = useRef<HTMLSelectElement>(null);
  const styleSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('sppu_history');
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch (e) { console.error(e); }
    }
    const savedStyles = localStorage.getItem('sppu_custom_styles');
    if (savedStyles) {
      try { setCustomStyles(JSON.parse(savedStyles)); } catch (e) { console.error(e); }
    }
    const savedTheme = localStorage.getItem('sppu_theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sppu_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('sppu_custom_styles', JSON.stringify(customStyles));
  }, [customStyles]);

  useEffect(() => {
    localStorage.setItem('sppu_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const parseQuestions = (text: string): string[] => {
    if (!isBatchMode) return [text.trim()].filter(q => q.length > 5);
    const lines = text.split('\n');
    const questions: string[] = [];
    let currentQ = "";
    lines.forEach(line => {
      const trimmedLine = line.trim();
      const isNewQuestion = /^(([qQ]\d+[\.\:\s])|(\d+[\.\)\:\s])|(\([a-zA-Z0-9]+\))|([a-zA-Z][\.\)\s]))/.test(trimmedLine);
      if (isNewQuestion && currentQ.length > 5) {
        questions.push(currentQ.trim());
        currentQ = line;
      } else {
        currentQ += (currentQ ? "\n" : "") + line;
      }
    });
    if (currentQ.trim().length > 5) questions.push(currentQ.trim());
    return questions.slice(0, 20);
  };

  const detectedCount = parseQuestions(questionInput).length;

  const handleGenerate = async () => {
    const questions = parseQuestions(questionInput);
    if (questions.length === 0) {
      setError("Please enter a valid question.");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const customStyleObj = customStyles.find(s => s.name === style);
      const results: GeneratedAnswer[] = [];
      for (const q of questions) {
        const answerText = await generateSPPUAnswer(q, marks, style, customStyleObj?.instruction);
        const newAnswer: GeneratedAnswer = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          question: q,
          marks,
          style,
          answer: answerText,
          timestamp: Date.now(),
        };
        results.push(newAnswer);
      }
      setCurrentAnswer(results[results.length - 1]);
      setHistory(prev => [...results.reverse(), ...prev].slice(0, 20));
      if (isBatchMode) setQuestionInput(''); 
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCustomStyle = () => {
    if (!newStyleName.trim() || !newStylePrompt.trim()) return;
    
    if (editingStyleId) {
      setCustomStyles(prev => prev.map(s => 
        s.id === editingStyleId 
          ? { ...s, name: newStyleName.trim(), instruction: newStylePrompt.trim() } 
          : s
      ));
      if (style === customStyles.find(s => s.id === editingStyleId)?.name) {
        setStyle(newStyleName.trim());
      }
    } else {
      const newStyle: CustomStyle = {
        id: Date.now().toString(),
        name: newStyleName.trim(),
        instruction: newStylePrompt.trim(),
      };
      setCustomStyles(prev => [...prev, newStyle]);
      setStyle(newStyle.name);
    }
    
    resetStyleForm();
  };

  const resetStyleForm = () => {
    setNewStyleName('');
    setNewStylePrompt('');
    setEditingStyleId(null);
    setShowAddStyleModal(false);
  };

  const startEditStyle = (customStyle: CustomStyle) => {
    setNewStyleName(customStyle.name);
    setNewStylePrompt(customStyle.instruction);
    setEditingStyleId(customStyle.id);
    setShowAddStyleModal(true);
    setShowManageStylesModal(false);
  };

  const deleteStyle = (id: string) => {
    if (window.confirm("Delete this custom style?")) {
      const deletedStyle = customStyles.find(s => s.id === id);
      setCustomStyles(prev => prev.filter(s => s.id !== id));
      if (style === deletedStyle?.name) {
        setStyle(DefaultAnswerStyle.MODEL_ANSWER);
      }
    }
  };

  const handleSuggest = async () => {
    if (!topicInput.trim()) return;
    setIsSuggesting(true);
    try {
      const questionsText = await suggestSPPUQuestions(topicInput);
      if (questionsText) {
        setIsBatchMode(true);
        setQuestionInput(questionsText);
        setShowSuggestInput(false);
        setTopicInput('');
      }
    } catch (e) {
      setError("Failed to suggest questions.");
    } finally {
      setIsSuggesting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const copyAllSolutions = () => {
    if (history.length === 0) return;
    const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);
    const formattedText = sortedHistory.map((item, index) => {
      return `${index + 1}. QUESTION: ${item.question}\n(Marks: ${item.marks}, Style: ${item.style})\n\nANSWER:\n${item.answer}\n\n${'-'.repeat(40)}\n`;
    }).join('\n');
    copyToClipboard(formattedText, 'copy-all');
  };

  const downloadPDF = () => {
    if (!currentAnswer) return;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxLineWidth = pageWidth - margin * 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("SPPU Model Answer", margin, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()} • ${currentAnswer.marks} Marks`, margin, 28);
    doc.line(margin, 32, pageWidth - margin, 32);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.setFontSize(11);
    const splitQuestion = doc.splitTextToSize(`Question: ${currentAnswer.question}`, maxLineWidth);
    doc.text(splitQuestion, margin, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let yPos = 42 + (splitQuestion.length * 5) + 8;
    const splitAnswer = doc.splitTextToSize(currentAnswer.answer, maxLineWidth);
    doc.text(splitAnswer, margin, yPos);
    doc.save(`SPPU_Answer_${currentAnswer.id}.pdf`);
  };

  const downloadWord = () => {
    if (!currentAnswer) return;
    const htmlHeader = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><style>body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.4; color: #000; } h1 { color: #312e81; font-size: 18pt; margin-bottom: 5pt; } .meta { color: #64748b; font-size: 10pt; margin-bottom: 20pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 10pt; } .question { font-weight: bold; font-size: 12pt; margin-bottom: 15pt; background-color: #f8fafc; padding: 10pt; border-left: 4pt solid #312e81; } .point { margin-bottom: 4pt; } .point-num { font-weight: bold; color: #4338ca; } .point-title { font-weight: bold; color: #000; }</style></head>
      <body><h1>SPPU Model Answer</h1><div class="meta">Date: ${new Date().toLocaleDateString()} | Weightage: ${currentAnswer.marks} Marks | Style: ${currentAnswer.style}</div><div class="question">Q: ${currentAnswer.question}</div><div class="content">${currentAnswer.answer.split('\n').filter(l => l.trim() !== '').map(line => { const pointMatch = line.match(/^(\d+\)|[a-zA-Z]\))\s*(.*?)(\*\*|$)(.*)$/); if (pointMatch) { const [, number, title, , content] = pointMatch; return `<div class="point"><span class="point-num">${number}</span> <span class="point-title">${title}**</span> ${content}</div>`; } return `<p>${line}</p>`; }).join('')}</div></body></html>`;
    const blob = new Blob(['\ufeff', htmlHeader], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SPPU_Answer_${currentAnswer.id}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    if (currentAnswer?.id === id) setCurrentAnswer(null);
  };

  const handleStepClick = (index: number) => {
    if (index === 0) {
      textareaRef.current?.focus();
    } else if (index === 1) {
      marksSelectRef.current?.focus();
    } else if (index === 2) {
      handleGenerate();
    }
  };

  const themeClasses = isDarkMode 
    ? {
        bg: 'bg-slate-950',
        card: 'bg-slate-900 border-slate-800 shadow-slate-950/50',
        text: 'text-white',
        textMuted: 'text-slate-400',
        input: 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500',
        historyItem: 'bg-slate-800/50 border-slate-700 hover:border-slate-600',
        historyItemActive: 'bg-indigo-950/30 border-indigo-800 shadow-indigo-950/50',
        answerHeader: 'bg-slate-900/50 border-slate-800',
        answerContent: 'text-slate-200',
        modalBg: 'bg-slate-900 border-slate-800',
        modalOverlay: 'bg-black/70 backdrop-blur-md',
        footer: 'text-slate-600',
      }
    : {
        bg: 'bg-slate-50',
        card: 'bg-white border-slate-100 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)]',
        text: 'text-black',
        textMuted: 'text-slate-500',
        input: 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400',
        historyItem: 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm',
        historyItemActive: 'bg-indigo-50 border-indigo-200 shadow-sm',
        answerHeader: 'bg-slate-50/50 border-slate-100',
        answerContent: 'text-slate-700',
        modalBg: 'bg-white border-slate-200',
        modalOverlay: 'bg-slate-900/60 backdrop-blur-md',
        footer: 'text-slate-500',
      };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${themeClasses.bg} selection:bg-emerald-100 font-['Inter']`}>
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1e1b4b] to-[#312e81] text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white p-2 rounded-xl shadow-md">
              <BookOpen className="w-7 h-7 text-[#1e1b4b]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SPPU EXAM MASTER</h1>
              <p className="text-[10px] font-medium text-indigo-300 uppercase tracking-widest opacity-80">Model Answer Generator</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="bg-indigo-900/40 px-4 py-2 rounded-full border border-indigo-700/50 flex items-center gap-2">
                <span className="text-xs font-semibold text-indigo-100 opacity-80">#</span>
                <span className="text-xs font-bold text-indigo-50 tracking-wider">History: {history.length}/20</span>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          <div className="lg:col-span-5 flex flex-col gap-8">
            <section className={`${themeClasses.card} p-8 rounded-[2rem] border transition-all relative overflow-hidden`}>
              {/* Decorative top bar */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-indigo-500 opacity-40"></div>
              
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className={`text-base font-bold uppercase tracking-tight ${themeClasses.text}`}>Question Input</h2>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${themeClasses.textMuted}`}>Academic Workspace</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`flex items-center p-2 rounded-xl transition-all shadow-sm active:scale-95 border ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-slate-100 border-slate-200 text-indigo-600'
                    }`}
                  >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => setShowSuggestInput(true)}
                    className="flex items-center p-2 bg-[#fff7ed] text-[#9a3412] rounded-xl hover:bg-[#ffedd5] transition-all border border-[#fdba74]/30 shadow-sm active:scale-95"
                  >
                    <Sparkles className="w-5 h-5 text-orange-400" />
                  </button>
                  <button 
                    onClick={() => setIsBatchMode(!isBatchMode)}
                    className={`flex items-center p-2 rounded-xl transition-all shadow-sm active:scale-95 border ${
                      isBatchMode 
                      ? 'bg-indigo-600 text-white border-indigo-500' 
                      : isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100'
                    }`}
                  >
                    <ListChecks className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    className={`w-full px-6 py-5 border rounded-3xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50/20 transition-all resize-none h-48 text-sm font-medium shadow-inner ${themeClasses.input}`}
                    placeholder="Paste your questions here starting with numbers..."
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                  />
                  {detectedCount > 0 && isBatchMode && (
                     <div className="absolute bottom-4 right-4 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm animate-pulse">
                        {detectedCount} Detected
                     </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest ml-1 ${themeClasses.textMuted}`}>Marks</label>
                    <div className="relative">
                      <select
                        ref={marksSelectRef}
                        className={`w-full px-5 py-4 border rounded-2xl text-sm font-bold appearance-none focus:border-indigo-400 transition-all cursor-pointer ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                        value={marks}
                        onChange={(e) => setMarks(e.target.value as MarksWeightage)}
                      >
                        <option value={MarksWeightage.TWO}>2 Marks</option>
                        <option value={MarksWeightage.FIVE}>5 Marks</option>
                        <option value={MarksWeightage.EIGHT}>8 Marks</option>
                        <option value={MarksWeightage.TEN}>10 Marks</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className={`text-[10px] font-bold uppercase tracking-widest ${themeClasses.textMuted}`}>Answer Style</label>
                      <button 
                        onClick={() => setShowManageStylesModal(true)} 
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase flex items-center gap-1 transition-colors"
                      >
                        <Settings className="w-3 h-3" /> Manage
                      </button>
                    </div>
                    <div className="relative">
                      <select
                        ref={styleSelectRef}
                        className={`w-full px-5 py-4 border rounded-2xl text-sm font-bold appearance-none focus:border-indigo-400 transition-all cursor-pointer ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                        value={style}
                        onChange={(e) => setStyle(e.target.value)}
                      >
                        <optgroup label="Default Styles">
                          {Object.values(DefaultAnswerStyle).map(s => <option key={s} value={s}>{s}</option>)}
                        </optgroup>
                        {customStyles.length > 0 && (
                          <optgroup label="Custom Styles">
                            {customStyles.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                          </optgroup>
                        )}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className={`w-full py-5 rounded-2xl font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                    isLoading 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg border-b-4 border-emerald-900'
                  }`}
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {isLoading ? 'Processing Solutions...' : `Generate ${detectedCount > 0 ? detectedCount : 'All'} Answers`}
                </button>
                {error && <p className="text-red-500 text-[10px] font-bold text-center bg-red-50 py-3 rounded-xl border border-red-100 uppercase tracking-tight">{error}</p>}
              </div>
            </section>

            <section className={`${themeClasses.card} p-8 rounded-[2rem] border flex flex-col min-h-[300px] transition-all`}>
              <div className="flex items-center gap-3 mb-6">
                <Clock className="w-5 h-5 text-indigo-500" />
                <h2 className={`text-base font-bold uppercase tracking-tight ${themeClasses.text}`}>Recent History</h2>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin relative pl-4">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-20 py-10">
                    {/* Fixed: Use 'History' icon from lucide-react instead of undefined 'HistoryIcon' */}
                    <History className="w-12 h-12 mb-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Workspace Empty</span>
                  </div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id} 
                      className={`relative p-4 border rounded-2xl transition-all cursor-pointer group flex gap-4 items-center ${
                        currentAnswer?.id === item.id ? themeClasses.historyItemActive : themeClasses.historyItem
                      }`}
                      onClick={() => setCurrentAnswer(item)}
                    >
                      <div className={`${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'} p-3 rounded-xl border ${isDarkMode ? 'border-slate-600' : 'border-slate-100'}`}>
                        <FileText className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-500'}`}>
                          {item.marks}M • {item.style}
                        </span>
                        <p className={`text-xs font-bold line-clamp-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item.question}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }} className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="lg:col-span-7">
            {currentAnswer ? (
              <div className={`${themeClasses.card} rounded-[3rem] border overflow-hidden min-h-[850px] flex flex-col animate-in slide-in-from-right duration-500`}>
                <div className={`${themeClasses.answerHeader} border-b px-10 py-10 flex flex-wrap items-center justify-between gap-6`}>
                  <div className="flex flex-col max-w-[70%]">
                    <span className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-2">Evaluated Solution</span>
                    <h3 className={`text-xl font-bold leading-tight ${themeClasses.text}`}>{currentAnswer.question}</h3>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={downloadPDF} className={`p-4 border rounded-2xl transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'}`}><Download className="w-6 h-6" /></button>
                    <button onClick={downloadWord} className="px-8 py-4 bg-[#312e81] hover:bg-[#1e1b4b] text-white rounded-2xl flex items-center gap-3 text-xs font-bold uppercase tracking-wider shadow-lg"><FileText className="w-5 h-5" /> Export</button>
                  </div>
                </div>
                <div className="flex-1 p-14 overflow-y-auto scrollbar-thin">
                   <div className={`text-lg leading-relaxed space-y-8 font-medium ${themeClasses.answerContent}`}>
                    {currentAnswer.answer.split('\n').filter(l => l.trim() !== '').map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>
                </div>
                <div className={`${themeClasses.answerHeader} px-12 py-10 border-t flex justify-center gap-6`}>
                  <button onClick={() => copyToClipboard(currentAnswer.answer, 'current')} className={`flex flex-col items-center gap-3 py-6 px-10 rounded-3xl border-2 transition-all font-bold uppercase text-[10px] tracking-widest ${copiedId === 'current' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-100 hover:border-emerald-200'}`}>
                    {copiedId === 'current' ? <Check className="w-6 h-6" /> : <Clipboard className="w-6 h-6" />}
                    <span>Copy Single</span>
                  </button>
                  <button onClick={copyAllSolutions} className={`flex flex-col items-center gap-3 py-6 px-10 rounded-3xl border-2 transition-all font-bold uppercase text-[10px] tracking-widest ${copiedId === 'copy-all' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-100 hover:border-emerald-200'}`}>
                    {copiedId === 'copy-all' ? <Check className="w-6 h-6" /> : <ClipboardList className="w-6 h-6" />}
                    <span>Copy All</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className={`h-full rounded-[4rem] border-4 border-dashed flex flex-col items-center justify-center p-12 text-center min-h-[850px] shadow-inner relative overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50/50 border-white'}`}>
                <div className={`${themeClasses.card} max-w-xl w-full p-12 py-16 rounded-[3rem] border relative z-10 flex flex-col items-center transition-all`}>
                   <h3 className={`text-[28px] font-bold tracking-tight mb-12 ${themeClasses.text}`}>Academic Model Answer Lab</h3>
                   
                   {/* Modern Process Stepper */}
                   <div className="w-full space-y-12 relative mb-12">
                      {/* Vertical Connector Line */}
                      <div className="absolute left-[31px] top-8 bottom-8 w-0.5 bg-emerald-100 dark:bg-slate-800 hidden sm:block"></div>

                      {[
                        { 
                          icon: <MousePointer2 className="w-6 h-6 text-indigo-500" />, 
                          title: "1. Paste Questions", 
                          desc: "Input one or multiple questions into the workspace.",
                          action: () => textareaRef.current?.focus()
                        },
                        { 
                          icon: <FontIcon className="w-6 h-6 text-emerald-500" />, 
                          title: "2. Select Marks & Style", 
                          desc: "Choose from 2-10 marks and professional evaluator styles.",
                          action: () => marksSelectRef.current?.focus()
                        },
                        { 
                          icon: <Zap className="w-6 h-6 text-orange-500" />, 
                          title: "3. Generate & Export", 
                          desc: "Receive formatted solutions ready for PDF/Word export.",
                          action: handleGenerate
                        },
                      ].map((step, i) => (
                        <div 
                          key={i} 
                          onClick={step.action}
                          className="flex items-start gap-6 group cursor-pointer text-left hover:translate-x-1 transition-transform"
                        >
                           <div className={`shrink-0 w-16 h-16 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center relative z-10 group-hover:shadow-md transition-all ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
                              {step.icon}
                           </div>
                           <div className="flex flex-col pt-1">
                              <h4 className={`text-lg font-bold tracking-tight mb-1 group-hover:text-emerald-600 transition-colors ${themeClasses.text}`}>{step.title}</h4>
                              <p className={`text-xs font-medium leading-relaxed max-w-xs ${themeClasses.textMuted}`}>{step.desc}</p>
                           </div>
                        </div>
                      ))}
                   </div>

                   <button 
                    onClick={() => setShowAddStyleModal(true)} 
                    className="group relative bg-emerald-600 hover:bg-emerald-700 text-white px-14 py-5 rounded-[1.25rem] font-bold uppercase text-[11px] tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-lg border-b-4 border-emerald-900"
                   >
                    <PenTool className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    Setup Custom Format
                   </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className={`py-12 text-center opacity-30 ${themeClasses.footer}`}>
        <p className="text-[10px] font-bold uppercase tracking-[1em]">SAVITRIBAI PHULE PUNE UNIVERSITY • ENGINE v2.5</p>
      </footer>

      {/* Modals - Simplified for Professional Aesthetics */}
      {showManageStylesModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[115] px-4">
          <div className={`absolute inset-0 ${themeClasses.modalOverlay}`} onClick={() => setShowManageStylesModal(false)} />
          <div className={`${themeClasses.modalBg} w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl border relative flex flex-col max-h-[70vh] transition-all`}>
            <div className="flex items-center justify-between mb-8">
              <h3 className={`font-bold uppercase text-xs tracking-widest ${themeClasses.text}`}>Styles Repository</h3>
              <button onClick={() => setShowManageStylesModal(false)} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin pr-2">
              {customStyles.length === 0 ? (
                <div className="text-center py-10 opacity-30 italic text-sm">No custom templates configured.</div>
              ) : (
                customStyles.map(s => (
                  <div key={s.id} className={`p-4 border rounded-2xl flex items-center justify-between ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <span className={`text-sm font-bold ${themeClasses.text}`}>{s.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => startEditStyle(s)} className="p-2 text-indigo-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => deleteStyle(s.id)} className="p-2 text-red-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => { setShowManageStylesModal(false); setShowAddStyleModal(true); }} className="mt-8 w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-2xl shadow-xl transition-all active:scale-95">
              <Plus className="w-4 h-4 inline mr-2" /> Define New Style
            </button>
          </div>
        </div>
      )}

      {showAddStyleModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[120] px-4">
          <div className={`absolute inset-0 ${themeClasses.modalOverlay}`} onClick={resetStyleForm} />
          <div className={`${themeClasses.modalBg} w-full max-w-md p-10 rounded-[2.5rem] border shadow-2xl relative transition-all`}>
            <div className="flex items-center justify-between mb-8">
              <h3 className={`font-bold uppercase text-xs tracking-widest ${themeClasses.text}`}>{editingStyleId ? 'Modify Format' : 'Create Formatting'}</h3>
              <button onClick={resetStyleForm} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className={`text-[10px] font-bold uppercase tracking-widest ml-2 ${themeClasses.textMuted}`}>Format Identity</label>
                <input type="text" placeholder="e.g., Table Comparison" className={`w-full px-5 py-4 border rounded-2xl text-sm outline-none font-bold ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`} value={newStyleName} onChange={(e) => setNewStyleName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className={`text-[10px] font-bold uppercase tracking-widest ml-2 ${themeClasses.textMuted}`}>System Prompt</label>
                <textarea placeholder="Describe the desired structure..." className={`w-full px-5 py-4 border rounded-2xl text-sm outline-none font-bold h-32 resize-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`} value={newStylePrompt} onChange={(e) => setNewStylePrompt(e.target.value)} />
              </div>
              <button onClick={handleSaveCustomStyle} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-xl transition-all">Persist Style Configuration</button>
            </div>
          </div>
        </div>
      )}

      {showSuggestInput && (
        <div className="fixed inset-0 flex items-center justify-center z-[130] px-4">
          <div className={`absolute inset-0 ${themeClasses.modalOverlay}`} onClick={() => setShowSuggestInput(false)} />
          <div className={`${themeClasses.modalBg} w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl border relative transition-all`}>
            <div className="flex justify-between items-center mb-8">
              <h3 className={`font-bold uppercase text-xs tracking-widest ${themeClasses.text}`}>Topic Brainstorming</h3>
              <button onClick={() => setShowSuggestInput(false)} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-6">
              <div className="relative">
                <input type="text" placeholder="Subject or Chapter Name" className="w-full px-5 py-5 border-2 border-emerald-100 dark:border-emerald-900 rounded-2xl text-base font-bold text-black outline-none focus:border-emerald-500 transition-colors" value={topicInput} onChange={(e) => setTopicInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSuggest()} autoFocus />
                <Wand2 className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-300" />
              </div>
              <button onClick={handleSuggest} disabled={isSuggesting || !topicInput.trim()} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-xl border-b-4 border-emerald-900 active:scale-95 transition-all disabled:opacity-50">
                {isSuggesting ? 'Analyzing Curriculum...' : 'Predict 10 Questions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
