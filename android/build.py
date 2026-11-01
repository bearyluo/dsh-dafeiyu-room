"""Build a signed, self-contained APK with an existing JDK17 + Android35 SDK.

No Gradle, network dependency resolution, SDK license acceptance, or secret
pairing links baked into the APK. Run from any working directory.
"""
from pathlib import Path
import argparse, os, subprocess, zipfile, shutil, hashlib, sys
sys.stdout.reconfigure(encoding='utf-8')

parser=argparse.ArgumentParser()
parser.add_argument('--jdk',required=True)
parser.add_argument('--tools',required=True,help='Android Build Tools 35 folder')
parser.add_argument('--platform',required=True,help='Android35 folder containing android.jar')
parser.add_argument('--out',required=True)
parser.add_argument('--keystore',help='Existing local-development signing key; default: android/build/local-development.jks')
args=parser.parse_args()
here=Path(__file__).resolve().parent
build=here/'build';build.mkdir(exist_ok=True)
for folder in ['classes','generated','dex','assets']:
    target=(build/folder).resolve()
    if target.parent!=build.resolve():raise ValueError('Build output escaped Android build directory')
    if target.exists():shutil.rmtree(target)
classes=build/'classes';classes.mkdir(exist_ok=True)
generated=build/'generated';generated.mkdir(exist_ok=True)
dex=build/'dex';dex.mkdir(exist_ok=True)
jdk=Path(args.jdk).resolve();tools=Path(args.tools).resolve();platform=Path(args.platform).resolve()
env={**os.environ,'JAVA_HOME':str(jdk),'PATH':str(jdk/'bin')+os.pathsep+os.environ['PATH']}
def run(*parts):
    result=subprocess.run([str(part) for part in parts],env=env,capture_output=True,text=True,encoding='utf-8',errors='replace')
    if result.stdout.strip():print(result.stdout.strip())
    if result.stderr.strip():print(result.stderr.strip())
    result.check_returncode()

run(tools/'aapt2.exe','compile','--dir',here/'res','-o',build/'resources.zip')
# Package exactly the original camera renderer and assets; no remote scripts.
assets=build/'assets/web';assets.mkdir(parents=True,exist_ok=True)
web=here.parent/'web'
for p in web.rglob('*'):
    if p.is_file() and (p.suffix in ['.png','.cjs','.js','.css'] or p.name=='index.html') and not p.name.startswith(('mobile','android')):
        target=assets/p.relative_to(web);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
shutil.copyfile(here.parent/'LICENSE',build/'assets/LICENSE')
for name in ['HOME_ART.md','LO_SPRITE_LICENSE.txt']:
    shutil.copyfile(web/'assets'/name,assets/'assets'/name)
run(tools/'aapt2.exe','link','-o',build/'resources.apk','-I',platform/'android.jar','--manifest',here/'AndroidManifest.xml','--java',generated,'-A',build/'assets',build/'resources.zip')
sources=[*here.joinpath('src').rglob('*.java'),*generated.rglob('*.java')]
run(jdk/'bin/javac.exe','-J-Duser.language=en','-encoding','UTF-8','-source','8','-target','8','-bootclasspath',str(platform/'android.jar')+os.pathsep+str(tools/'core-lambda-stubs.jar'),'-d',classes,*sources)
jar=build/'classes.jar'
with zipfile.ZipFile(jar,'w',zipfile.ZIP_DEFLATED) as archive:
    for p in classes.rglob('*.class'):archive.write(p,p.relative_to(classes).as_posix())
run(jdk/'bin/java.exe','-cp',tools/'lib/d8.jar','com.android.tools.r8.D8','--lib',platform/'android.jar','--min-api','26','--release','--output',dex,jar)
unsigned=build/'unsigned.apk'
with zipfile.ZipFile(build/'resources.apk') as base, zipfile.ZipFile(unsigned,'w') as archive:
    for entry in base.infolist():archive.writestr(entry.filename,base.read(entry),compress_type=entry.compress_type)
    archive.write(dex/'classes.dex','classes.dex',compress_type=zipfile.ZIP_DEFLATED)
run(tools/'zipalign.exe','-f','4',unsigned,build/'aligned.apk')
key=Path(args.keystore).resolve() if args.keystore else build/'local-development.jks'
if not key.exists():run(jdk/'bin/keytool.exe','-genkeypair','-keystore',key,'-storepass','android','-keypass','android','-alias','room','-keyalg','RSA','-keysize','2048','-validity','3650','-dname','CN=Dafeiyu Room Local Development')
out=Path(args.out).resolve();out.parent.mkdir(parents=True,exist_ok=True)
run(jdk/'bin/java.exe','-jar',tools/'lib/apksigner.jar','sign','--ks',key,'--ks-key-alias','room','--ks-pass','pass:android','--key-pass','pass:android','--out',out,build/'aligned.apk')
run(jdk/'bin/java.exe','-jar',tools/'lib/apksigner.jar','verify','--verbose',out)
print('APK:',out,'SHA256:',hashlib.sha256(out.read_bytes()).hexdigest())
