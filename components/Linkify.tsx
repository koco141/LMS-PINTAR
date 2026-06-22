import React from 'react';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export default function Linkify({ children }: { children: string | undefined | null }) {
  if (!children) return null;
  
  const parts = children.split(URL_REGEX);
  
  return (
    <>
      {parts.map((part, i) => {
        if (part.match(URL_REGEX)) {
          return (
            <a 
              key={i} 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: 'var(--primary)', textDecoration: 'underline', wordBreak: 'break-all' }}
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
