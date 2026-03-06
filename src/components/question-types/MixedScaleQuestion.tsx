import React from 'react';

interface MixedScaleProps {
  question: any;
  value: any; // { value: number, text: string }
  onChange: (value: any) => void;
}

export const MixedScaleQuestion: React.FC<MixedScaleProps> = ({ question, value, onChange }) => {
  const currentScale = value?.value;
  const currentText = value?.text || '';

  const handleScaleChange = (val: number) => {
    onChange({ ...value, value: val });
  };

  const handleTextChange = (text: string) => {
    onChange({ ...value, text });
  };

  return (
    <div className="w-full space-y-8">
      <div className="space-y-4">
        <p className="font-display text-xl text-g2">{question.scaleText}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {question.scaleOptions.map((opt: any) => (
            <button
              key={opt.value}
              onClick={() => handleScaleChange(opt.value)}
              className={`p-4 rounded-xl border text-left transition-all ${
                currentScale === opt.value
                  ? 'bg-primary/10 border-primary text-white'
                  : 'bg-d2 border-d3 text-g2 hover:border-g4 hover:bg-d3'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-mono ${
                   currentScale === opt.value ? 'border-primary bg-primary text-white' : 'border-g3 text-g3'
                }`}>
                  {opt.value}
                </div>
                <span className="font-body">{opt.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-display text-xl text-g2">{question.openText}</p>
        <textarea
          className="w-full h-32 bg-d2 border border-d3 rounded-xl p-4 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none font-body"
          placeholder="Profundiza en tu respuesta..."
          value={currentText}
          onChange={(e) => handleTextChange(e.target.value)}
        />
      </div>
    </div>
  );
};
