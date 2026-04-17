import React from 'react';

interface MixedConditionalProps {
  question: any;
  value: any; // { choice: string, text: string }
  onChange: (value: any) => void;
}

export const MixedConditionalQuestion: React.FC<MixedConditionalProps> = ({ question, value, onChange }) => {
  const currentChoice = value?.choice;
  const currentText = value?.text || '';

  const handleChoiceChange = (val: string) => {
    onChange({ ...value, choice: val });
  };

  const handleTextChange = (text: string) => {
    onChange({ ...value, text });
  };

  const showConditional = question.conditionalIf.includes(currentChoice);

  return (
    <div className="w-full space-y-8">
      <div className="space-y-4">

        <div className="grid grid-cols-1 gap-3">
          {question.closedOptions.map((opt: any) => (
            <button
              key={opt.value}
              onClick={() => handleChoiceChange(opt.value)}
              className={`p-4 rounded-xl border text-left transition-all ${
                currentChoice === opt.value
                  ? 'bg-primary/10 border-primary text-[#111111]'
                  : 'bg-d2 border-d3 text-g2 hover:border-g4 hover:bg-d3'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                   currentChoice === opt.value ? 'border-primary bg-primary' : 'border-g3'
                }`}>
                   {currentChoice === opt.value && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <span className="font-body">{opt.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {showConditional && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <p className="font-display text-xl text-g2">{question.conditionalText}</p>
          <textarea
            className="w-full h-32 bg-d2 border border-d3 rounded-xl p-4 text-base text-[#111111] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none font-body"
            placeholder="Escribe aquí..."
            value={currentText}
            onChange={(e) => handleTextChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};
