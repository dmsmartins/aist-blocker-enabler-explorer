// Keep numeric timeline IDs and the workbook's stable G0–G5 keys distinct.
export function gateKey(gate) {
  if (/^G[0-5]$/.test(gate?.gate_id)) return gate.gate_id;
  return Number.isInteger(gate?.id) && gate.id >= 0 && gate.id <= 5 ? `G${gate.id}` : null;
}

export function guidanceFor(payload, key) {
  const matches = (payload?.stageGates || []).filter(g => g.gate_id === key);
  if (matches.length !== 1 || matches[0].show_guidance === false) return null;
  const gate = matches[0];
  const lines = payload?.isoLines || [];
  return {
    ...gate,
    actions: [1, 2, 3].map(i => ({id: gate[`action_${i}_id`], text: gate[`action_${i}_text`]})).filter(a => a.text),
    categories: String(gate.iso_lines || '').split('|').filter(Boolean).map(token => {
      const line = lines.find(l => l.iso_line === token);
      return {token, label: line?.display_label || token, color: /^#[0-9a-f]{6}$/i.test(line?.color_hex) ? line.color_hex : '#718595'};
    })
  };
}
