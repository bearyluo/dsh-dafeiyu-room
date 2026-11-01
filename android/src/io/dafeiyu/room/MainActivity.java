package io.dafeiyu.room;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.text.InputType;
import android.view.*;
import android.webkit.WebView;
import android.widget.*;

public final class MainActivity extends Activity {
    private static final int INK=0xff284b3c,MUTED=0xff77887d,PAPER=0xfff3f5ef;
    private EditText link;private TextView status,signal,endpoint,permissionState;private Button permissionButton;
    private LinearLayout form;private FrameLayout previewHost;private WebView preview;
    private boolean notificationChecked=false,visible=false;
    private String versionName(){try{return getPackageManager().getPackageInfo(getPackageName(),0).versionName;}catch(Exception e){return "Preview";}}
    private SharedPreferences prefs(){return getSharedPreferences("room",MODE_PRIVATE);}
    private int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private GradientDrawable bg(int color,int radius){GradientDrawable b=new GradientDrawable();b.setColor(color);b.setCornerRadius(dp(radius));return b;}
    private TextView text(String value,int size,int color){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setIncludeFontPadding(false);return t;}
    private void space(LinearLayout parent,int height){parent.addView(new View(this),new LinearLayout.LayoutParams(1,dp(height)));}
    private LinearLayout column(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);return v;}
    private Button button(String label,boolean primary){
        Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setTextSize(15);b.setTextColor(primary?Color.WHITE:INK);b.setBackground(bg(primary?INK:0xffe5ebe2,14));b.setMinHeight(dp(48));b.setMinimumHeight(dp(48));b.setPadding(dp(16),dp(12),dp(16),dp(12));return b;
    }
    @Override public void onCreate(Bundle state){super.onCreate(state);
        getWindow().setStatusBarColor(PAPER);getWindow().setNavigationBarColor(PAPER);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(PAPER);scroll.setClipToPadding(false);
        if(Build.VERSION.SDK_INT>=30)scroll.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;});
        LinearLayout page=column();page.setPadding(dp(22),dp(24),dp(22),dp(24));scroll.addView(page,new ScrollView.LayoutParams(-1,-2));
        LinearLayout heading=new LinearLayout(this);heading.setGravity(Gravity.CENTER_VERTICAL);
        ImageView icon=new ImageView(this);icon.setImageResource(R.drawable.house);icon.setPadding(dp(13),dp(13),dp(13),dp(13));icon.setBackground(bg(0xffe1e9dc,17));heading.addView(icon,new LinearLayout.LayoutParams(dp(52),dp(52)));
        LinearLayout titles=column();titles.setPadding(dp(14),0,0,0);TextView title=text("大肥鱼的小屋",24,INK);title.setTypeface(null,1);titles.addView(title);space(titles,7);titles.addView(text("随身看看她的生活  /  "+versionName(),12,MUTED));heading.addView(titles,new LinearLayout.LayoutParams(0,-2,1));page.addView(heading);space(page,22);
        LinearLayout sceneCard=column();sceneCard.setPadding(dp(10),dp(12),dp(10),dp(12));sceneCard.setBackground(bg(Color.WHITE,22));
        signal=text("●  离线休息 · 本地画面",12,MUTED);signal.setPadding(dp(6),0,dp(6),dp(12));sceneCard.addView(signal);
        previewHost=new FrameLayout(this){@Override protected void onMeasure(int w,int h){int width=View.MeasureSpec.getSize(w);super.onMeasure(w,View.MeasureSpec.makeMeasureSpec(Math.round(width*.75f),View.MeasureSpec.EXACTLY));}};
        previewHost.setBackground(bg(INK,16));previewHost.setClipToOutline(true);sceneCard.addView(previewHost,new LinearLayout.LayoutParams(-1,dp(220)));
        TextView caption=text("离线时显示她在床上休息，连上后同步真实活动。",12,MUTED);caption.setPadding(dp(6),dp(12),dp(6),0);caption.setLineSpacing(dp(3),1);sceneCard.addView(caption);page.addView(sceneCard);space(page,18);
        LinearLayout settings=column();settings.setPadding(dp(18),dp(16),dp(18),dp(16));settings.setBackground(bg(Color.WHITE,20));
        TextView settingsTitle=text("连接与权限",16,INK);settingsTitle.setTypeface(null,1);settings.addView(settingsTitle);space(settings,16);
        LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);LinearLayout computer=column();computer.addView(text("电脑连接",14,INK));space(computer,6);endpoint=text("尚未连接",12,MUTED);computer.addView(endpoint);row.addView(computer,new LinearLayout.LayoutParams(0,-2,1));Button edit=button("修改",false);edit.setTextSize(12);edit.setOnClickListener(v->{form.setVisibility(form.getVisibility()==View.VISIBLE?View.GONE:View.VISIBLE);});row.addView(edit,new LinearLayout.LayoutParams(dp(68),dp(44)));settings.addView(row);space(settings,16);
        LinearLayout permissions=new LinearLayout(this);permissions.setGravity(Gravity.CENTER_VERTICAL);LinearLayout permissionText=column();permissionText.addView(text("悬浮窗权限",14,INK));space(permissionText,6);permissionState=text("未开启",12,MUTED);permissionText.addView(permissionState);permissions.addView(permissionText,new LinearLayout.LayoutParams(0,-2,1));permissionButton=button("去开启",false);permissionButton.setTextSize(12);permissionButton.setOnClickListener(v->{try{startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getPackageName())));}catch(Exception e){status.setText("请在系统设置中允许此应用显示在其他应用上层。");}});permissions.addView(permissionButton,new LinearLayout.LayoutParams(dp(82),dp(44)));settings.addView(permissions);
        form=column();space(form,16);form.addView(text("粘贴电脑生成的完整小屋连接",12,MUTED));space(form,8);link=new EditText(this);link.setTextSize(13);link.setTextColor(INK);link.setHint("http://电脑地址:8797/…#key=…");link.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);link.setMaxLines(3);link.setText(prefs().getString("pairing",""));form.addView(link,new LinearLayout.LayoutParams(-1,-2));space(form,8);Button save=button("保存连接并预览",false);save.setOnClickListener(v->{try{RoomConnection c=RoomConnection.parse(link.getText().toString());prefs().edit().putString("pairing",c.pairingUrl()).apply();form.setVisibility(View.GONE);updateSettings();openPreview();status.setText("连接已保存。");}catch(Exception e){status.setText(e.getMessage());}});form.addView(save,new LinearLayout.LayoutParams(-1,-2));form.setVisibility(prefs().getString("pairing","").isEmpty()?View.VISIBLE:View.GONE);settings.addView(form);page.addView(settings);space(page,18);
        Button start=button("开启悬浮小屋",true);start.setOnClickListener(v->startCabin());page.addView(start,new LinearLayout.LayoutParams(-1,dp(52)));space(page,10);
        Button stop=button("收起并关闭悬浮窗",false);stop.setOnClickListener(v->{stopService(new Intent(this,RoomOverlayService.class));status.setText("悬浮窗已关闭，可以继续在这里看看她。");});page.addView(stop,new LinearLayout.LayoutParams(-1,dp(48)));
        status=text("",12,MUTED);status.setPadding(dp(4),dp(12),dp(4),dp(8));page.addView(status);
        TextView tip=text("拖动小房子可以移动，点一下展开画面。\n手机与电脑需连接同一 Wi-Fi。",12,MUTED);tip.setGravity(Gravity.CENTER);tip.setLineSpacing(dp(5),1);page.addView(tip);setContentView(scroll);readIntent(getIntent());
    }
    private void updateSettings(){
        boolean allowed=Settings.canDrawOverlays(this);permissionState.setText(allowed?"已开启":"允许后可浮在其他应用上方");permissionState.setTextColor(allowed?INK:MUTED);permissionButton.setText(allowed?"已开启":"去开启");
        try{endpoint.setText(RoomConnection.parse(prefs().getString("pairing","")).origin);}catch(Exception e){endpoint.setText("扫码连接，或粘贴电脑提供的链接");}
    }
    private void openPreview(){
        destroyPreview();if(!visible)return;
        RoomConnection paired=null;try{paired=RoomConnection.parse(prefs().getString("pairing",""));}catch(Exception ignored){}
        preview=new WebView(this);CabinWebClient.configure(preview);preview.setWebViewClient(new CabinWebClient(this,paired,(reachable,connected)->runOnUiThread(()->{if(!visible)return;signal.setText(connected?"●  电脑在线 · 正在同步她的活动":reachable?"●  主会话离线 · 本地休息画面":"●  连接未建立 · 本地休息画面");signal.setTextColor(connected?0xff44735a:MUTED);})));previewHost.addView(preview,new FrameLayout.LayoutParams(-1,-1));preview.loadUrl(CabinWebClient.LOCAL+"index.html");
    }
    private void destroyPreview(){if(preview!=null){preview.stopLoading();previewHost.removeView(preview);preview.destroy();preview=null;}}
    @Override protected void onResume(){super.onResume();visible=true;updateSettings();openPreview();}
    @Override protected void onPause(){visible=false;destroyPreview();super.onPause();}
    @Override protected void onDestroy(){destroyPreview();super.onDestroy();}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);readIntent(intent);}
    private void readIntent(Intent intent){
        Uri data=intent.getData();if(data==null||!"dafeiyuroom".equals(data.getScheme())||!"connect".equals(data.getHost()))return;
        String value=data.getQueryParameter("url");if(value!=null)try{RoomConnection parsed=RoomConnection.parse(value);link.setText(parsed.pairingUrl());form.setVisibility(View.VISIBLE);status.setText("新连接已填入，保存预览或开启悬浮小屋即可。");}catch(Exception e){status.setText(e.getMessage());}
    }
    private void startCabin(){
        try{
            RoomConnection value=RoomConnection.parse(link.getText().toString());
            if(!Settings.canDrawOverlays(this)){status.setText("请先开启悬浮窗权限，再返回这里。");return;}
            prefs().edit().putString("pairing",value.pairingUrl()).apply();
            if(Build.VERSION.SDK_INT>=33&&!notificationChecked&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED){notificationChecked=true;requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},1);return;}
            startForegroundService(new Intent(this,RoomOverlayService.class));status.setText("小房子已显示，点击它展开画面。");moveTaskToBack(true);
        }catch(Exception e){status.setText(e.getMessage()==null?"无法开启小屋，请检查权限和连接。":e.getMessage());}
    }
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){super.onRequestPermissionsResult(code,permissions,results);if(code==1)startCabin();}
}
