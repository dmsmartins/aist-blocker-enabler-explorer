export async function loadDependencyDataset({snapshot=null,fetcher=fetch}={}) {
  const response=await fetcher('../data/explorer-data.json',{cache:'no-cache'});
  if(!response.ok)throw new Error('Could not load the dependency dataset');
  const data=await response.json();
  if(!Array.isArray(data.blockers)||!Array.isArray(data.blockerDependencies))throw new Error('Invalid dependency dataset');
  if(snapshot){
    const ids=new Set(data.blockers.map(b=>b.id));
    if(Object.keys(snapshot.blockerStatuses||{}).some(id=>!ids.has(Number(id))))throw new Error('The dataset does not match this assessment.');
  }
  return data;
}
