import React, { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlow, Background, Controls, MiniMap, Handle, Position, MarkerType, applyNodeChanges } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const labels = { start: '发起', approval: '审批', condition: '条件', notify: '通知', end: '结束',form:'表单',parallel:'会签',confirm:'确认',data:'更新',delay:'等待' };
const symbols = { start: '↗', approval: '✓', condition: '◇', notify: '♧', end: '◎',form:'▤',parallel:'⑂',confirm:'✓',data:'▦',delay:'◷' };
function BusinessNode({ data }) {
  const { node: n, active, passed } = data;
  return <div className={`ff-canvas-node ${n.type} ${active ? 'is-selected' : ''} ${passed ? 'is-passed' : ''}`}>
    {n.type !== 'start' && <Handle type="target" position={Position.Top} id="in" />}
    <div className="ff-node-icon">{symbols[n.type]}</div>
    <div><small>{labels[n.type]}</small><strong>{n.label}</strong><p>{data.description}</p></div>
    {n.type === 'condition' ? <><Handle type="source" position={Position.Bottom} style={{ left: '24%' }} id="yes" /><span className="ff-port-label yes">满足</span><Handle type="source" position={Position.Bottom} style={{ left: '76%' }} id="no" /><span className="ff-port-label no">不满足</span></> : n.type !== 'end' && <Handle type="source" position={Position.Bottom} id="next" />}
  </div>;
}
const nodeTypes = { business: BusinessNode };
function Canvas({ flow, selected, onSelect, onMove, onConnect, onEdge,onAdd, path = [], viewport, onViewport }) {
  const [currentViewport,setCurrentViewport]=useState(viewport||{x:0,y:0,zoom:1});
  const actors = Object.fromEntries(flow.actors.map(a => [a.id, a.name]));
  const [nodes, setNodes] = useState(() => flow.nodes.map(n => ({ id: n.id, position: n.position, selected: n.id === selected, type: 'business', data: { node: n, active: n.id === selected, passed: path.includes(n.id), description: n.type === 'approval' ? actors[n.config.assignee] || '未配置审批人' : n.type === 'condition' ? `${n.config.field === 'amount' ? '金额' : '天数'} ${({ gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=' })[n.config.operator]} ${n.config.value}` : n.type === 'notify' ? `接收人：${actors[n.config.recipient] || '未配置'}` : n.type === 'start' ? '表单提交 · 手动发起' : '记录最终处理结果' } })));
  const edges = flow.edges.map(e => { const passed=path.some((id,index)=>id===e.source&&path[index+1]===e.target);return { id: e.id, source: e.source, target: e.target, sourceHandle: e.port, targetHandle: 'in', type: 'smoothstep', animated:passed, markerEnd: { type: MarkerType.ArrowClosed, color: passed?'#7257ef':'#b8a1d4' }, style: { stroke: passed?'#7257ef':e.port === 'yes' ? '#69aa82' : e.port === 'no' ? '#d07d86' : '#bca6d3', strokeWidth: passed?2.6:1.5 }, label: e.port === 'yes' ? '满足' : e.port === 'no' ? '不满足' : undefined, labelStyle: { fill: e.port==='yes'?'#3f8a60':e.port==='no'?'#b65e68':'#a28ab6', fontSize: 10,fontWeight:600 }, labelBgStyle: { fill: '#fff' } }});
  const onNodesChange = useCallback(changes => {
    setNodes(current => applyNodeChanges(changes, current));
    for (const change of changes) if (change.type === 'position' && change.position && !change.dragging) onMove(change.id, change.position);
  }, [onMove]);
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeClick={(_, n) => onSelect(n.id)} onEdgeClick={(_,e)=>onEdge?.(e.id)} onNodeDragStop={(_, n) => onMove(n.id, n.position)} onConnect={c => onConnect(c.source, c.target, c.sourceHandle)} onMoveEnd={(_, vp) => {setCurrentViewport(vp);onViewport(vp);}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';}} onDrop={e=>{e.preventDefault();const type=e.dataTransfer.getData('application/flow-node');if(!type)return;const rect=e.currentTarget.getBoundingClientRect();onAdd?.(type,{x:(e.clientX-rect.left-currentViewport.x)/currentViewport.zoom,y:(e.clientY-rect.top-currentViewport.y)/currentViewport.zoom});}} defaultViewport={viewport} fitView={!viewport} fitViewOptions={{ padding: .24, maxZoom: .9 }} minZoom={.25} maxZoom={1.5} deleteKeyCode={null} proOptions={{ hideAttribution: false }} ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': '放大画布', 'controls.zoomOut.ariaLabel': '缩小画布', 'controls.fitView.ariaLabel': '适应画布', 'controls.interactive.ariaLabel': '切换画布交互' }}>
    <Background gap={20} size={1} color="#e5dbf0" /><Controls showInteractive={false} /><MiniMap nodeColor={n => n.data.node.type === 'condition' ? '#ead7b6' : '#d6c5ec'} maskColor="#f7f5fa99" pannable zoomable />
  </ReactFlow>;
}
export function mountFlowCanvas(element, options) { const root = createRoot(element); root.render(<Canvas {...options} />); return () => root.unmount(); }
