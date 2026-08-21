// import React, { useState, useEffect } from 'react';
// import { useNavigate, useSearchParams } from 'react-router-dom';
// import { Button } from '../components/ui/Button';
// import { useAssessmentStore } from '../store/useAssessmentStore';

// export default function GatePage() {
//   const navigate = useNavigate();
//   const [searchParams] = useSearchParams();
//   const { setRole, setEnterprise } = useAssessmentStore();
//   const [selectedRole, setSelectedRole] = useState<string | null>(null);

//   const isEnterprise = searchParams.get('type') === 'enterprise';

//   useEffect(() => {
//     if (isEnterprise) {
//       setEnterprise(true);
//     }
//   }, [isEnterprise, setEnterprise]);

//   const handleStart = () => {
//     if (selectedRole) {
//       setRole(selectedRole as any);
//       navigate('/assessment');
//     }
//   };

//   const roles = [
//     { id: 'csuite', icon: '🏛️', label: 'C-Suite / VP' },
//     { id: 'manager', icon: '👥', label: 'Manager / Lead' },
//     { id: 'colaborador', icon: '💼', label: 'Colaborador' },
//     { id: 'independiente', icon: '🧑💻', label: 'Independiente' }
//   ];

//   return (
//     <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center p-5 md:p-12 relative overflow-hidden">
//       {/* Glow Background */}
//       <div 
//         className="absolute inset-0 pointer-events-none"
//         style={{
//           background: 'radial-gradient(ellipse at center, rgba(254,60,28,0.04) 0%, transparent 60%)'
//         }}
//       />

//       <div className="relative z-10 w-full max-w-[720px] flex flex-col items-center">
        
//         {/* Eyebrow */}
//         <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
//           <span className="font-mono text-[9px] tracking-[0.4em] text-primary uppercase mb-5 block text-center">
//             {isEnterprise ? 'DIAGNÓSTICO ENTERPRISE' : 'ANTES DE COMENZAR'}
//           </span>
//         </div>

//         {/* Quote */}
//         <div 
//           className="animate-fade-in-up mb-10 pl-4 md:pl-5 border-l-2 border-primary max-w-[540px] text-left"
//           style={{ animationDelay: '100ms' }}
//         >
//           <p className="font-body text-[14px] md:text-[16px] font-light text-[#555555] leading-[1.7]">
//             Este diagnóstico analiza tu comportamiento real con IA — no lo que crees saber, sino lo que realmente haces. Las respuestas honestas dan resultados accionables.
//             {isEnterprise && " Los resultados se agregan con los de tu equipo."}
//           </p>
//         </div>

//         {/* Selector Label */}
//         <div className="animate-fade-in-up w-full" style={{ animationDelay: '200ms' }}>
//           <p className="font-mono text-[10px] text-[#AAAAAA] text-center mb-4 uppercase tracking-wider">
//             Selecciona tu rol para personalizar la experiencia:
//           </p>
//         </div>

//         {/* Role Cards Grid */}
//         <div 
//           className="animate-fade-in-up grid grid-cols-2 md:grid-cols-4 gap-[3px] w-full mb-6"
//           style={{ animationDelay: '300ms' }}
//         >
//           {roles.map((role) => (
//             <button
//               key={role.id}
//               onClick={() => setSelectedRole(role.id)}
//               className={`
//                 relative flex flex-col items-center gap-2 px-[14px] py-[18px]
//                 bg-[#EFEFEF] border rounded-[2px] transition-all duration-200 cursor-pointer min-h-[100px]
//                 hover:bg-[rgba(254,60,28,0.08)] hover:border-[rgba(254,60,28,0.4)] hover:-translate-y-[1px]
//                 ${selectedRole === role.id 
//                   ? 'bg-[rgba(254,60,28,0.08)] border-[#FE3C1C] translate-y-0' 
//                   : 'border-[#CCCCCC]'
//                 }
//               `}
//             >
//               <span className="text-[24px] leading-none">{role.icon}</span>
//               <span className="font-body text-[11px] font-semibold text-[#111111] text-center">
//                 {role.label}
//               </span>
              
//               {selectedRole === role.id && (
//                 <span className="absolute top-[8px] right-[8px] text-primary text-[11px] font-bold">
//                   ✓
//                 </span>
//               )}
//             </button>
//           ))}
//         </div>

//         {/* CTA Button */}
//         <div 
//           className="animate-fade-in-up flex flex-col items-center mt-6 w-full"
//           style={{ animationDelay: '500ms' }}
//         >
//           <div 
//             className="transition-opacity duration-300 ease-in-out w-full md:w-auto"
//             style={{ opacity: selectedRole ? 1 : 0.35 }}
//           >
//             <Button 
//               variant="primary" 
//               onClick={handleStart}
//               disabled={!selectedRole}
//               className="w-full md:w-auto min-h-[48px]"
//             >
//               {isEnterprise ? 'Comenzar diagnóstico de equipo →' : 'Comenzar diagnóstico →'}
//             </Button>
//           </div>

//           {/* Microcopy */}
//           <p className="font-mono text-[9px] text-[#AAAAAA] text-center mt-3 uppercase tracking-wider">
//             Sin registro · ~12 minutos · Confidencial
//           </p>
//         </div>

//       </div>
//     </div>
//   );
// }
