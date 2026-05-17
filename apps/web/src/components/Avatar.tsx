import React from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
}

export function Avatar({ src, name, size = 40 }: AvatarProps) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size, height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      backgroundColor: '#D85A30',
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}
