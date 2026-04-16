import React from 'react';

interface MixedMultiProps {
  question: any;
  value: any; // { selected: string[], text: string }
  onChange: (value: any) => void;
}

export const MixedMultiQuestion: React.FC<MixedMultiProps> = ({ question, value, onChange }) => {
  const selected = value?.selected || [];
  const currentText = value?.text || '';

  const max = question.max ?? null;

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      const newSelected = selected.filter((s: string) => s !== option);
      onChange({ ...value, selected: newSelected });
    } else {
      if (max !== null && selected.length >= max) return;
      onChange({ ...value, selected: [...selected, option] });
    }
  };

  const handleTextChange = (text: string) => {
    onChange({ ...value, text });
  };

  return (
    <div className="w-full space-y-8">
      <div className="space-y-4">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {question.multiOptions.map((opt: string) => (
            <button
              key={opt}
              onClick={() => toggleOption(opt)}
              className={`p-4 rounded-xl border text-left transition-all ${
                selected.includes(opt)
                  ? 'bg-primary/10 border-primary text-[#111111]'
                  : 'bg-d2 border-d3 text-g2 hover:border-g4 hover:bg-d3'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                   selected.includes(opt) ? 'border-primary bg-primary' : 'border-g3'
                }`}>
                  {selected.includes(opt) && <div className="w-2 h-2 bg-white rounded-sm" />}
                </div>
                <span className="font-body">{opt}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {question.openText && (
        <div className="space-y-2">
          <p className="font-display text-xl text-g2">{question.openText}</p>
          <textarea
            className="w-full h-32 bg-d2 border border-d3 rounded-xl p-4 text-[#111111] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none font-body"
            placeholder="Cuéntame más..."
            value={currentText}
            onChange={(e) => handleTextChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};
