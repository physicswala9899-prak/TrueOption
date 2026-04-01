import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => {
  return (
    <img 
      src="https://i.ibb.co/5WQV0JB3/Whats-App-Image-2026-04-01-at-16-11-12.jpg" 
      alt="TrueOption Logo" 
      className={`${className} object-contain rounded-lg`}
      referrerPolicy="no-referrer"
    />
  );
};
