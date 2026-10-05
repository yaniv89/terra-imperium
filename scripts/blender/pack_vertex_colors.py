"""Loss-bounded glTF vertex color packing; no geometric or image compression."""
import json,struct
from pathlib import Path
import numpy as np

def compact_colors(path):
 path=Path(path);raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);start=20+n;size,kind=struct.unpack_from('<I4s',raw,start);assert kind==b'BIN\0';binary=raw[start+8:start+8+size]
 indices={p['attributes']['COLOR_0'] for m in doc.get('meshes',[]) for p in m['primitives'] if 'COLOR_0' in p['attributes']};replace={};max_error=0
 for index in indices:
  a=doc['accessors'][index]
  if a['componentType']!=5126:continue
  assert a['type'] in ('VEC3','VEC4') and not a.get('byteOffset') and 'sparse' not in a
  vi=a['bufferView'];v=doc['bufferViews'][vi];assert not v.get('byteStride')
  assert sum(x.get('bufferView')==vi for x in doc['accessors'])==1
  values=np.frombuffer(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']],dtype='<f4');assert np.isfinite(values).all() and values.min()>=0 and values.max()<=1
  packed=np.rint(values*255).astype(np.uint8);max_error=max(max_error,float(np.max(np.abs(values-packed.astype(float)/255))));replace[vi]=packed.tobytes();a['componentType']=5121;a['normalized']=True
  for key in ('min','max'):a.pop(key,None)
 if not replace:return {'changed':False,'bytes':len(raw)}
 out=bytearray()
 for i,v in enumerate(doc['bufferViews']):
  assert v.get('buffer',0)==0
  data=replace.get(i,binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);out.extend(b'\0'*(-len(out)%4));v['byteOffset']=len(out);v['byteLength']=len(data);out.extend(data)
 doc['buffers'][0]['byteLength']=len(out);out.extend(b'\0'*(-len(out)%4));j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*(-len(j)%4)
 result=struct.pack('<4sII',b'glTF',2,28+len(j)+len(out))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(out),b'BIN\0')+out
 path.write_bytes(result);assert max_error<=.5/255+1e-7
 return {'changed':True,'before':len(raw),'after':len(result),'max_color_error':max_error,'geometry_and_images_unchanged':True}
if __name__=='__main__':
 import sys
 print(compact_colors(sys.argv[1]))
