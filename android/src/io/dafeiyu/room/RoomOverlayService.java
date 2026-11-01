package io.dafeiyu.room;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.content.res.Configuration;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import java.net.URL;
import java.net.HttpURLConnection;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

public final class RoomOverlayService extends Service {
    private static final String CHANNEL="cabin",LOCAL="https://room.dafeiyu.invalid/";
    private WindowManager windows;private View bubble;private FrameLayout panel;private WebView camera;
    private WindowManager.LayoutParams iconParams,panelParams;private SharedPreferences prefs;
    private RoomConnection connection;private boolean receiverRegistered=false,expanded=false;
    private BroadcastReceiver screenReceiver;
    private final AtomicBoolean closing=new AtomicBoolean(false);
    private int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public void onCreate(){super.onCreate();windows=(WindowManager)getSystemService(WINDOW_SERVICE);prefs=getSharedPreferences("room",MODE_PRIVATE);}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent!=null&&"stop".equals(intent.getAction())){stopSelf();return START_NOT_STICKY;}
        if(!Settings.canDrawOverlays(this)){stopSelf();return START_NOT_STICKY;}
        try{connection=RoomConnection.parse(prefs.getString("pairing",""));}catch(Exception e){stopSelf();return START_NOT_STICKY;}
        NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL,"小屋悬浮窗",NotificationManager.IMPORTANCE_LOW));
        PendingIntent settings=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,RoomOverlayService.class).setAction("stop"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notice=new Notification.Builder(this,CHANNEL).setSmallIcon(R.drawable.house).setContentTitle("大肥鱼的小屋").setContentText("小房子正在悬浮 · 点击打开设置").setContentIntent(settings).setOngoing(true).setShowWhen(false).addAction(new Notification.Action.Builder(null,"关闭悬浮窗",stop).build()).build();
        if(Build.VERSION.SDK_INT>=34)startForeground(601,notice,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);else startForeground(601,notice);
        if(bubble==null)try{showBubble();}catch(Exception error){stopSelf();return START_NOT_STICKY;}
        else if(expanded){collapse();expand();}
        if(!receiverRegistered){screenReceiver=new BroadcastReceiver(){@Override public void onReceive(Context c,Intent i){if(Intent.ACTION_SCREEN_OFF.equals(i.getAction()))collapse();}};IntentFilter filter=new IntentFilter(Intent.ACTION_SCREEN_OFF);if(Build.VERSION.SDK_INT>=33)registerReceiver(screenReceiver,filter,RECEIVER_NOT_EXPORTED);else registerReceiver(screenReceiver,filter);receiverRegistered=true;}
        return START_NOT_STICKY; // Never restart an overlay without a user action.
    }
    private Rect area(){
        if(Build.VERSION.SDK_INT>=30){WindowMetrics m=windows.getCurrentWindowMetrics();Rect r=new Rect(m.getBounds());Insets in=m.getWindowInsets().getInsetsIgnoringVisibility(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());r.left+=in.left;r.top+=in.top;r.right-=in.right;r.bottom-=in.bottom;return r;}
        android.util.DisplayMetrics m=new android.util.DisplayMetrics();windows.getDefaultDisplay().getMetrics(m);return new Rect(0,dp(24),m.widthPixels,m.heightPixels-dp(24));
    }
    private WindowManager.LayoutParams params(int width,int height){
        WindowManager.LayoutParams p=new WindowManager.LayoutParams(width,height,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,PixelFormat.TRANSLUCENT);p.gravity=Gravity.TOP|Gravity.LEFT;return p;
    }
    private void clamp(WindowManager.LayoutParams p){Rect a=area();int gap=dp(8);p.x=Math.max(a.left+gap,Math.min(a.right-p.width-gap,p.x));p.y=Math.max(a.top+gap,Math.min(a.bottom-p.height-gap,p.y));}
    private GradientDrawable background(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(9));return d;}
    private void showBubble(){
        ImageButton icon=new ImageButton(this);icon.setImageResource(R.drawable.house);icon.setContentDescription("打开小屋摄像头");icon.setPadding(dp(13),dp(13),dp(13),dp(13));icon.setBackground(background(0xffe6eddf));icon.setElevation(dp(4));
        Rect a=area();iconParams=params(dp(48),dp(48));iconParams.x=dp(prefs.getFloat("iconX",a.right/getResources().getDisplayMetrics().density-62));iconParams.y=dp(prefs.getFloat("iconY",a.bottom/getResources().getDisplayMetrics().density-90));clamp(iconParams);
        bubble=icon;icon.setOnTouchListener(new Drag(iconParams,false,()->{if(expanded)collapse();else expand();}));windows.addView(bubble,iconParams);
    }
    private void sizePanel(int requested){Rect a=area();int max=Math.max(1,Math.min(a.width()-dp(16),Math.round((a.height()-dp(16))*4f/3)));int min=Math.min(dp(220),max);panelParams.width=Math.max(min,Math.min(max,requested));panelParams.height=Math.round(panelParams.width*.75f);clamp(panelParams);}
    private void expand(){
        if(expanded||closing.get()||!Settings.canDrawOverlays(this))return;
        try{
            panelParams=params(dp(prefs.getFloat("width",320)),dp(240));Rect a=area();panelParams.x=dp(prefs.getFloat("panelX",16));panelParams.y=dp(prefs.getFloat("panelY",a.top/getResources().getDisplayMetrics().density+72));sizePanel(panelParams.width);
            panel=new FrameLayout(this);panel.setBackground(background(0xff203d32));panel.setClipToOutline(true);panel.setElevation(dp(6));
            camera=new WebView(this);CabinWebClient.configure(camera);
            camera.setWebViewClient(new CabinWebClient(this,connection,null));camera.setOnTouchListener(new Drag(panelParams,false,null));panel.addView(camera,new FrameLayout.LayoutParams(-1,-1));
            LinearLayout controls=new LinearLayout(this);controls.setOrientation(LinearLayout.HORIZONTAL);
            Button fit=control("⛶","放大或还原小屋");fit.setOnClickListener(v->{Rect bounds=area();int max=Math.min(bounds.width()-dp(16),Math.round((bounds.height()-dp(16))*4f/3));boolean isMax=Math.abs(panelParams.width-max)<dp(2);sizePanel(isMax?dp(prefs.getFloat("width",320)):max);windows.updateViewLayout(panel,panelParams);});controls.addView(fit,new LinearLayout.LayoutParams(dp(44),dp(44)));
            Button close=control("×","收起为小房子");close.setOnClickListener(v->collapse());controls.addView(close,new LinearLayout.LayoutParams(dp(44),dp(44)));
            FrameLayout.LayoutParams cp=new FrameLayout.LayoutParams(-2,dp(44),Gravity.TOP|Gravity.RIGHT);cp.setMargins(0,dp(4),dp(4),0);panel.addView(controls,cp);
            Button resize=control("◢","拖动调整小屋大小");resize.setOnTouchListener(new Drag(panelParams,true,null));panel.addView(resize,new FrameLayout.LayoutParams(dp(44),dp(44),Gravity.BOTTOM|Gravity.RIGHT));
            windows.addView(panel,panelParams);expanded=true;((ImageButton)bubble).setContentDescription("收起小屋摄像头");camera.loadUrl(LOCAL+"index.html");
        }catch(Exception error){destroyPanel();Toast.makeText(this,"无法显示小屋，请检查悬浮窗权限或重新打开应用。",Toast.LENGTH_LONG).show();}
    }
    private Button control(String text,String description){Button b=new Button(this);b.setText(text);b.setTextSize(18);b.setTextColor(0xffedf2e7);b.setContentDescription(description);b.setPadding(0,0,0,0);b.setMinHeight(0);b.setMinWidth(0);b.setMinimumWidth(0);b.setMinimumHeight(0);b.setBackground(background(0xcc284b3c));return b;}
    private void save(WindowManager.LayoutParams p,boolean icon){float d=getResources().getDisplayMetrics().density;prefs.edit().putFloat(icon?"iconX":"panelX",p.x/d).putFloat(icon?"iconY":"panelY",p.y/d).apply();}
    private void collapse(){if(!expanded)return;save(panelParams,false);destroyPanel();if(bubble instanceof ImageButton)((ImageButton)bubble).setContentDescription("打开小屋摄像头");}
    private void destroyPanel(){expanded=false;if(camera!=null){camera.stopLoading();camera.onPause();if(panel!=null)panel.removeView(camera);camera.destroy();camera=null;}if(panel!=null){try{windows.removeView(panel);}catch(Exception ignored){}panel=null;}}
    @Override public void onConfigurationChanged(Configuration config){super.onConfigurationChanged(config);if(bubble!=null){clamp(iconParams);windows.updateViewLayout(bubble,iconParams);}if(expanded){sizePanel(dp(prefs.getFloat("width",320)));windows.updateViewLayout(panel,panelParams);}}
    @Override public void onDestroy(){closing.set(true);destroyPanel();if(bubble!=null){try{save(iconParams,true);windows.removeView(bubble);}catch(Exception ignored){}bubble=null;}if(receiverRegistered)unregisterReceiver(screenReceiver);stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
    private final class Drag implements View.OnTouchListener {
        final WindowManager.LayoutParams p;final boolean resize;final Runnable click;float downX,downY;int startX,startY,startW;boolean moved;
        Drag(WindowManager.LayoutParams p,boolean resize,Runnable click){this.p=p;this.resize=resize;this.click=click;}
        @Override public boolean onTouch(View view,android.view.MotionEvent e){
            if(e.getActionMasked()==MotionEvent.ACTION_DOWN){downX=e.getRawX();downY=e.getRawY();startX=p.x;startY=p.y;startW=p.width;moved=false;return true;}
            if(e.getActionMasked()==MotionEvent.ACTION_MOVE){float dx=e.getRawX()-downX,dy=e.getRawY()-downY;if(!moved&&Math.hypot(dx,dy)<dp(5))return true;moved=true;
                if(resize)sizePanel(startW+Math.round((dx+.75f*dy)/1.5625f));else{p.x=startX+Math.round(dx);p.y=startY+Math.round(dy);clamp(p);}try{windows.updateViewLayout(p==iconParams?bubble:panel,p);}catch(Exception ignored){}return true;}
            if(e.getActionMasked()==MotionEvent.ACTION_UP||e.getActionMasked()==MotionEvent.ACTION_CANCEL){if(moved){save(p,p==iconParams);if(resize)prefs.edit().putFloat("width",p.width/getResources().getDisplayMetrics().density).apply();}else if(e.getActionMasked()==MotionEvent.ACTION_UP&&click!=null){view.performClick();click.run();}return true;}return true;
        }
    }
}
