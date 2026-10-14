/** Cancel native page gestures without swallowing the game's pointer/tap/hold events. */
export function lockBrowserGestures(root:Document=document){
  const prevent=(event:Event)=>{if(event.cancelable)event.preventDefault();};
  const multiTouch=(event:TouchEvent)=>{if(event.touches.length>1)prevent(event);};
  const options={capture:true,passive:false};
  for(const name of ['gesturestart','gesturechange','gestureend','contextmenu','selectstart'])root.addEventListener(name,prevent,options);
  root.addEventListener('touchmove',multiTouch,options);
  return ()=>{
    for(const name of ['gesturestart','gesturechange','gestureend','contextmenu','selectstart'])root.removeEventListener(name,prevent,options);
    root.removeEventListener('touchmove',multiTouch,options);
  };
}
