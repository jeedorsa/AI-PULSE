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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {question.scaleOptions.map((opt: any) => (
            <button
              key={opt.value}
              onClick={() => handleScaleChange(opt.value)}
              className={`p-4 rounded-xl border text-left transition-all ${
                currentScale === opt.value
                  ? 'bg-primary/10 border-primary text-[#111111]'
                  : 'bg-d2 border-d3 text-g2 hover:border-g4 hover:bg-d3'
              }`}
            >
              <div className="flex items-center gap-3">
<span className="font-body">{opt.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {question.openText && (
        <div className="space-y-2">
          <p className="font-display text-xl text-g2">{question.openText}</p>
          <textarea
            className="w-full h-32 bg-d2 border border-d3 rounded-xl p-4 text-base text-[#111111] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none font-body"
            placeholder="Profundiza en tu respuesta..."
            value={currentText}
            onChange={(e) => handleTextChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};
