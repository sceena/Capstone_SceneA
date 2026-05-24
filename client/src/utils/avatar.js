const ANIMALS = ["🦁","🐯","🦊","🐺","🦝","🦔","🐻","🦄","🐸","🐧","🦋","🐬","🦅","🐨","🦒","🦘","🐙","🦩","🦚","🦜","🦫","🦦","🐿️","🦔"];
const COLORS  = ["#1B4F7A","#0F6E56","#6D3A9C","#B45309","#0E7490","#9D174D","#1E40AF","#065F46","#7C3AED","#C2410C","#047857","#1D4ED8"];

function hashCode(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getAvatar(email = "") {
  const h = hashCode(email);
  return {
    animal: ANIMALS[h % ANIMALS.length],
    color:  COLORS[(h >> 4) % COLORS.length],
  };
}
