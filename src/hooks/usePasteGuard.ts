import { useCallback, useState } from 'react';

/**
 * Bloquea el pegado de texto en un campo de respuesta abierta. Las preguntas
 * abiertas (y las de escritura de prompts en Sección C) evalúan cómo la
 * persona redacta su propia respuesta — permitir pegar invalidaría esa
 * medición, ya sea con texto propio copiado de otro lado o generado por IA.
 *
 * Se cubren las dos formas de meter texto ajeno en un textarea: el pegado
 * (Ctrl/Cmd+V y menú contextual, evento `paste`) y el arrastre de una
 * selección desde otra ventana o pestaña, que NO dispara `paste` sino `drop`.
 */
export function usePasteGuard() {
  const [blocked, setBlocked] = useState(false);

  const bloquear = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    setBlocked(true);
  }, []);

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => bloquear(e),
    [bloquear]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLTextAreaElement>) => bloquear(e),
    [bloquear]
  );

  // Sin cancelar el dragover el navegador nunca emite `drop` sobre el
  // textarea: lo trata como zona no soltable y hace su propio manejo.
  const onDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  }, []);

  const clearBlocked = useCallback(() => setBlocked(false), []);

  /** Props a esparcir sobre el textarea: `<textarea {...guardProps} />`. */
  const guardProps = { onPaste, onDrop, onDragOver };

  return { blocked, onPaste, onDrop, onDragOver, guardProps, clearBlocked };
}

export const PASTE_BLOCKED_MESSAGE = 'No se permite pegar texto — escríbelo con tus propias palabras.';
