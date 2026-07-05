import React from 'react';

export const Logo = ({ className = "h-12 w-auto", dark = false }: { className?: string, dark?: boolean }) => {
  const color = dark ? "currentColor" : "black";
  const accent = "#FF3B30"; // brand-red

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 500 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
      >
        {/* Poster Icons */}
        <g opacity="0.8">
          <rect x="140" y="20" width="40" height="60" rx="2" stroke={color} strokeWidth="2" transform="rotate(-15 140 20)" />
          <path d="M145 50 Q150 40 155 50 T165 50" stroke={color} strokeWidth="1" transform="rotate(-15 140 20)" />
          <circle cx="160" cy="35" r="3" fill={color} transform="rotate(-15 140 20)" />
          
          <rect x="190" y="15" width="45" height="65" rx="2" stroke={color} strokeWidth="2" transform="rotate(-5 190 15)" />
          <circle cx="212" cy="45" r="10" stroke={color} strokeWidth="1" transform="rotate(-5 190 15)" />
          <path d="M195 65 Q212 55 230 65" stroke={color} strokeWidth="1" transform="rotate(-5 190 15)" />
          
          <rect x="250" y="15" width="45" height="65" rx="2" stroke={color} strokeWidth="2" transform="rotate(5 250 15)" />
          <path d="M272 30 L272 65 M265 40 L280 35 M265 55 L280 50" stroke={color} strokeWidth="2" transform="rotate(5 250 15)" />
          
          <rect x="310" y="25" width="40" height="60" rx="2" stroke={color} strokeWidth="2" transform="rotate(15 310 25)" />
          <text x="315" y="45" fill={color} fontSize="6" fontWeight="bold" transform="rotate(15 310 25)">GOOD</text>
          <text x="315" y="55" fill={color} fontSize="6" fontWeight="bold" transform="rotate(15 310 25)">THINGS</text>
          <text x="315" y="65" fill={color} fontSize="6" fontWeight="bold" transform="rotate(15 310 25)">TAKE TIME</text>
        </g>

        {/* Sparkles */}
        <path d="M90 60 L95 55 L90 50 L85 55 Z" fill={color} />
        <path d="M110 40 L113 37 L110 34 L107 37 Z" fill={color} />
        <path d="M400 45 L405 40 L400 35 L395 40 Z" fill={color} />
        <path d="M430 70 L433 67 L430 64 L427 67 Z" fill={color} />

        {/* Main Text */}
        <text
          x="250"
          y="140"
          textAnchor="middle"
          fill={color}
          fontSize="72"
          fontWeight="900"
          letterSpacing="-3"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          POSTE<tspan fill={accent}>REALM</tspan>
        </text>

        {/* Tagline */}
        <line x1="120" y1="165" x2="190" y2="165" stroke={color} strokeWidth="2" />
        <text
          x="250"
          y="172"
          textAnchor="middle"
          fill={color}
          fontSize="14"
          fontWeight="bold"
          letterSpacing="4"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          STEP INTO YOUR REALM
        </text>
        <line x1="310" y1="165" x2="380" y2="165" stroke={color} strokeWidth="2" />
      </svg>
    </div>
  );
};
