import { useEffect, useRef, useState } from 'react';

interface ExpandableTextProps {
  text: string;
  resized?: void;
}

const ExpandableText = ({ text, resized }: ExpandableTextProps) => {
  const textRef = useRef<HTMLDivElement | null>(null);
  const [isClamped, setIsClamped] = useState(false);

  useEffect(() => {
    if (textRef.current) {
      setIsClamped(textRef.current.scrollHeight > textRef.current.clientHeight);
    }
  }, [text]);

  return (
    <details className="group">
      <summary className={`${isClamped ? 'cursor-pointer' : ''} flex w-full list-none flex-col`}>
        <div ref={textRef} className="line-clamp-3 text-justify group-open:line-clamp-none">
          {text}
        </div>
        {isClamped && (
          <>
            <div className="w-full p-1 text-center underline group-open:hidden">mehr anzeigen</div>
            <div className="hidden p-1 text-center underline group-open:inline">weniger anzeigen</div>
          </>
        )}
      </summary>
    </details>
  );
};

export default ExpandableText;
