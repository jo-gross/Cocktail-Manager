import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ExpandableTextProps {
  text: string;
}

export interface ExpandableTextHandle {
  recalculateClamp: () => void;
}

const ExpandableText = forwardRef<ExpandableTextHandle, ExpandableTextProps>(({ text }, ref) => {
  const { t } = useTranslation('common');
  const textRef = useRef<HTMLDivElement | null>(null);
  const [isClamped, setIsClamped] = useState(false);

  const checkClamp = () => {
    if (textRef.current) {
      setIsClamped(textRef.current.scrollHeight > textRef.current.clientHeight);
    }
  };

  useImperativeHandle(ref, () => ({
    recalculateClamp: checkClamp,
  }));

  useEffect(() => {
    checkClamp();
  }, [text]);

  return (
    <details className="group">
      <summary className={`${isClamped ? 'cursor-pointer' : ''} flex w-full list-none flex-col`}>
        <div ref={textRef} className="long-text-format line-clamp-3 group-open:line-clamp-none">
          {text}
        </div>
        {isClamped && (
          <>
            <div className="w-full p-1 text-center underline group-open:hidden">{t('showMore')}</div>
            <div className="hidden p-1 text-center underline group-open:inline">{t('showLess')}</div>
          </>
        )}
      </summary>
    </details>
  );
});

ExpandableText.displayName = 'ExpandableText';

export default ExpandableText;
