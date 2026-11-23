export function useOriginalCommunities(communityMode,search) {
  return communityMode && new URLSearchParams(search).get('version')==='original';
}

export async function loadDependencyDataset({original=false,snapshot=null,fetcher=fetch}) {
  const response=await fetcher(original?'../data/explorer-data.json':'../data/new-dependencies/explorer-data.json',{cache:'no-cache'});
  if(!response.ok)throw new Error('Could not load the dependency dataset');
  const data=await response.json();
  if(!Array.isArray(data.blockers)||!Array.isArray(data.blockerDependencies))throw new Error('Invalid dependency dataset');
  if(snapshot){
    const ids=new Set(data.blockers.map(b=>b.id));
    if(Object.keys(snapshot.blockerStatuses||{}).some(id=>!ids.has(Number(id))))throw new Error('The revised dataset does not match this assessment.');
  }
  return data;
}
