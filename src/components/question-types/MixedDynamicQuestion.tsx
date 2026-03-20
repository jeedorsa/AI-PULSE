import React from 'react';

interface MixedDynamicProps {
  question: any;
  value: any; // { selected: string[], origins: Record<string, string> }
  onChange: (value: any) => void;
}

export const MixedDynamicQuestion: React.FC<MixedDynamicProps> = ({ question, value, onChange }) => {
  const selected = value?.selected || [];
  const origins = value?.origins || {};

  const toggleOption = (option: string) => {
    const newSelected = selected.includes(option)
      ? selected.filter((s: string) => s !== option)
      : [...selected, option];
    
    // Clean up origin if deselected
    const newOrigins = { ...origins };
    if (!newSelected.includes(option)) {
      delete newOrigins[option];
    }

    onChange({ ...value, selected: newSelected, origins: newOrigins });
  };

  const handleOriginChange = (tool: string, origin: string) => {
    onChange({ 
      ...value, 
      origins: { ...origins, [tool]: origin } 
    });
  };

  return (
    <div className="w-full space-y-8">
      <div className="space-y-4">

        <div className="grid grid-cols-1 gap-3">
          {question.multiOptions.map((opt: string) => (
            <div key={opt} className="space-y-3">
              <button
                onClick={() => toggleOption(opt)}
                className={`w-full p-4 rounded-xl border text-left transition-all ${
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

              {selected.includes(opt) && (
                <div className="ml-8 p-4 bg-d2 rounded-lg border border-d3 animate-in fade-in slide-in-from-top-2">
                  <p className="text-sm text-g3 mb-3">{question.tableLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {question.tableOptions.map((origin: string) => (
                      <button
                        key={origin}
                        onClick={() => handleOriginChange(opt, origin)}
                        className={`px-3 py-1 rounded text-xs transition-colors ${
                          origins[opt] === origin
                            ? 'bg-primary text-white font-bold'
                            : 'bg-[#EEEEEE] text-[#555555] hover:bg-[#E0E0E0]'
                        }`}
                      >
                        {origin}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
