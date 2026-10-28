export function rankCommands(commands, query = '') {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return commands.map((command,index) => {
    const label = command.label.toLocaleLowerCase(), text = `${label} ${command.keywords || ''}`.toLocaleLowerCase();
    if (!terms.every(term => text.includes(term))) return null;
    return {command,index,score:terms.reduce((n,term)=>n+(label.startsWith(term)?4:label.includes(term)?2:1),0)};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.command);
}
export function nextCommandIndex(current, delta, count) {
  return count > 0 ? ((current + delta) % count + count) % count : -1;
}
