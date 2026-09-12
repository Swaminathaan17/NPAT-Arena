export default function Avatar({ player, small = false }) {
  return <span className={`avatar ${small ? 'small' : ''}`} style={{ background: player.color }}>{String(player.name || '?').trim().slice(0, 1).toUpperCase() || '?'}</span>;
}