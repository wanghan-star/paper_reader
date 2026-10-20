export type Box={x:number;y:number;width:number;height:number};
export type TextLine={x:number;top:number;width:number};

/**
 * The caption is shown as text under each figure, so a figure region that also encloses its caption
 * shows it twice. Cut the region just above a caption line ("Fig. 3", "Table 2") found in its lower part.
 */
export function cutCaption(box:Box,captions:TextLine[]):Box{
  let bottom=box.y+box.height;
  for(const line of captions){
    const overlaps=line.x<box.x+box.width&&line.x+line.width>box.x;
    if(overlaps&&line.top>box.y+box.height*.4&&line.top<bottom)bottom=line.top;
  }
  return bottom<box.y+box.height?{...box,height:Math.max(1,bottom-box.y-4)}:box;
}

/**
 * Tighten a model-estimated region against the page's actual ink. The model's coordinates are approximate,
 * so a figure or formula is often clipped or carries a blank margin. Each edge first moves outward while it
 * still cuts through ink (bounded, and stopping at the first blank gap), then inward over blank rows.
 * `ink` is a row-major grid (1 = dark pixel) of size columns x rows; the box uses the same grid units.
 */
export function refineBox(ink:Uint8Array,columns:number,rows:number,box:Box,reach=.04):Box{
  let left=Math.max(0,Math.floor(box.x)),top=Math.max(0,Math.floor(box.y));
  let right=Math.min(columns,Math.ceil(box.x+box.width)),bottom=Math.min(rows,Math.ceil(box.y+box.height));
  if(right-left<2||bottom-top<2)return box;
  const rowInk=(y:number)=>{if(y<0||y>=rows)return false;for(let x=left;x<right;x++)if(ink[y*columns+x])return true;return false;};
  const columnInk=(x:number)=>{if(x<0||x>=columns)return false;for(let y=top;y<bottom;y++)if(ink[y*columns+x])return true;return false;};
  const maxX=Math.ceil(columns*reach),maxY=Math.ceil(rows*reach);
  // Outward: only while the line just outside the edge is inked, i.e. the content continues past the box.
  for(let n=0;n<maxY&&rowInk(top-1);n++)top--;
  for(let n=0;n<maxY&&rowInk(bottom);n++)bottom++;
  for(let n=0;n<maxX&&columnInk(left-1);n++)left--;
  for(let n=0;n<maxX&&columnInk(right);n++)right++;
  // Inward: drop blank margins, but never shrink a side by more than a quarter of the box.
  const trimY=Math.floor((bottom-top)/4),trimX=Math.floor((right-left)/4);
  for(let n=0;n<trimY&&!rowInk(top);n++)top++;
  for(let n=0;n<trimY&&!rowInk(bottom-1);n++)bottom--;
  for(let n=0;n<trimX&&!columnInk(left);n++)left++;
  for(let n=0;n<trimX&&!columnInk(right-1);n++)right--;
  const padX=Math.max(2,Math.round(columns*.008)),padY=Math.max(2,Math.round(rows*.006));
  left=Math.max(0,left-padX);top=Math.max(0,top-padY);right=Math.min(columns,right+padX);bottom=Math.min(rows,bottom+padY);
  return {x:left,y:top,width:right-left,height:bottom-top};
}
