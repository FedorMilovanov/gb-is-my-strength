"""Negative controls for the static TOC auditor; temporary synthetic HTML, never Product."""
import json,pathlib,subprocess,sys,tempfile,unittest
SCRIPT=pathlib.Path(__file__).with_name('cross-route-audit.py')
class Controls(unittest.TestCase):
 def run_case(self,target,href='/target/#%D1%86%D0%B5%D0%BB%D1%8C'):
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp)/'dist';source=root/'source';source.mkdir(parents=True)
   (source/'index.html').write_text('<div id="partTocOverlay"><a href="'+href+'">go</a></div>')
   if target is not None:
    dest=root/'target';dest.mkdir();(dest/'index.html').write_text(target)
   result=subprocess.run([sys.executable,str(SCRIPT),'--dist',str(root),'--output',tmp+'/out'],capture_output=True,text=True)
   return result.returncode,json.loads((pathlib.Path(tmp)/'out/summary.json').read_text())
 def test_valid_cross_route_encoded_fragment(self):
  code,data=self.run_case('<h2 id="цель">Target</h2>');self.assertEqual(code,0);self.assertEqual(data['crossRouteFragments'],1)
 def test_missing_fragment_is_red(self):
  code,data=self.run_case('<h2 id="other">Target</h2>');self.assertEqual(code,1);self.assertEqual(data['failures'][0]['targetIdCount'],0)
 def test_duplicate_target_is_red(self):
  code,data=self.run_case('<h2 id="цель">A</h2><h3 id="цель">B</h3>');self.assertEqual(code,1);self.assertEqual(data['failures'][0]['targetIdCount'],2)
 def test_missing_route_is_red(self):
  code,data=self.run_case(None);self.assertEqual(code,1);self.assertFalse(data['failures'][0]['fileExists'])
 def test_relative_path_resolution(self):
  code,data=self.run_case('<h2 id="цель">Target</h2>','../target/#цель');self.assertEqual(code,0);self.assertEqual(data['crossRouteLinks'],1)
if __name__=='__main__':unittest.main()
