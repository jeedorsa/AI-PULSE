import { useCallback, useState } from 'react';

/**
 * Bloquea el pegado de texto en un campo de respuesta abierta. Las preguntas
 * abiertas (y las de escritura de prompts en Sección C) evalúan cómo la
 * persona redacta su propia respuesta — permitir pegar invalidaría esa
 * medición, ya sea con texto propio copiado de otro lado o generado por IA.
 */
export function usePasteGuard() {
  const [blocked, setBlocked] = useState(false);

  const onPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setBlocked(true);
  }, []);

  const clearBlocked = useCallback(() => setBlocked(false), []);

  return { blocked, onPaste, clearBlocked };
}

export const PASTE_BLOCKED_MESSAGE = 'No se permite pegar texto — escríbelo con tus propias palabras.';
