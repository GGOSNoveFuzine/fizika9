// Weapon and action artwork retained from 0.3.
export function icon(kind){
 const shapes={
 ball:'<circle cx="30" cy="31" r="18" fill="#b1c6d2"/><path d="M19 32a13 13 0 0 1 13-13" stroke="#efffff" stroke-width="4" fill="none"/><path d="M42 36a14 14 0 0 1-14 9" stroke="#677b8d" stroke-width="5" fill="none"/>',
 cone:'<path d="M12 43 29 11 49 43Z" fill="#d7b578" stroke="#ffe5b2" stroke-width="2"/><path d="m29 11 2 32H12Z" fill="#8c795a"/><ellipse cx="30" cy="43" rx="19" ry="6" fill="#79674f" stroke="#d7b578" stroke-width="2"/>',
 rod:'<path d="m11 46 7-15L45 6l8 8-25 29-17 3Z" fill="#a2c2cc" stroke="#d7f2f3" stroke-width="2"/><path d="m18 31 10 12 25-29-4-4Z" fill="#5d8897"/><path d="m13 44 12-6" stroke="#f3ffff" stroke-width="2"/>',
 cargo:'<path d="m10 39 1-20L26 8l23 8 6 20-15 17-21-2Z" fill="#ba9d81" stroke="#e3c8a5" stroke-width="2"/><path d="m11 19 20 6 9 28M31 25l18-9M31 25l-21 14" stroke="#806d63" stroke-width="3" fill="none"/><path d="m19 18 9-5 10 4" stroke="#e8d8b3" stroke-width="3" fill="none"/>',
 rock:'<path d="M6 24h22L19 7h9l15 17h11l5 5-5 5H43L28 51h-9l9-17H6l6-5Z" fill="#b8d6df" stroke="#edffff" stroke-width="2"/><path d="m40 45 10-2 5 8-8 9-10-6Z" fill="#c7a482"/>',
 shield:'<path d="M30 6 50 14v16c0 12-9 21-20 26C19 51 10 42 10 30V14Z" fill="#927eb5" stroke="#ddd0ff" stroke-width="3"/><path d="M30 15v29M20 29h20" stroke="#f0e8ff" stroke-width="5"/>',
 save:'<ellipse cx="27" cy="43" rx="19" ry="9" fill="#c78d36" stroke="#ffe0a2" stroke-width="2"/><path d="M8 35v8m38-8v8" stroke="#ffe0a2" stroke-width="2"/><ellipse cx="27" cy="35" rx="19" ry="9" fill="#efbd66" stroke="#ffe0a2" stroke-width="2"/><path d="M8 27v8m38-8v8" stroke="#ffe0a2" stroke-width="2"/><ellipse cx="27" cy="27" rx="19" ry="9" fill="#f5cf83" stroke="#ffe8b4" stroke-width="2"/><path d="M46 5v15M39 12h14" stroke="#a0f0b4" stroke-width="4"/>',
 fire:'<path d="m8 43 22-23 13 13-23 22Z" fill="#203749"/><path d="m25 25 15-15 12 12-15 15Z" fill="#fff1c1"/><path d="m43 8 5-6m5 14 7-2m-3 12 5 3" stroke="#fff1c1" stroke-width="3"/><circle cx="20" cy="46" r="8" fill="#334f61"/><path d="M7 56h34" stroke="#203749" stroke-width="4"/>'
 };
 return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${shapes[kind]||shapes.ball}</svg>`;
}
