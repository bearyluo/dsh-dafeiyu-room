package io.dafeiyu.room;
public final class RoomConnectionTest {
    public static void main(String[] args){
        String token="0123456789012345678901234567890123456789012";
        RoomConnection c=RoomConnection.parse("https://example.trycloudflare.com/plugins/dsh-dafeiyu-room/android.html#key="+token);
        if(!c.stateUrl().equals("https://example.trycloudflare.com/plugins/dsh-dafeiyu-room/state")||!c.token.equals(token))throw new AssertionError();
        RoomConnection.parse("https://example.com/plugins/dsh-dafeiyu-room/mobile.html#key="+token);
        for(String host:new String[]{"192.168.50.10:8797","10.0.0.5:8080","172.16.2.1:8797","172.31.255.254:8797"}){
            RoomConnection lan=RoomConnection.parse("http://"+host+"/plugins/dsh-dafeiyu-room/android.html#key="+token);if(!lan.stateUrl().startsWith("http://"+host+"/"))throw new AssertionError();
        }
        for(String value:new String[]{"http://example.com/plugins/dsh-dafeiyu-room/android.html#key="+token,"https://a:b@example.com/plugins/dsh-dafeiyu-room/android.html#key="+token,"http://8.8.8.8/plugins/dsh-dafeiyu-room/android.html#key="+token,"http://172.15.0.1/plugins/dsh-dafeiyu-room/android.html#key="+token,"http://172.32.0.1/plugins/dsh-dafeiyu-room/android.html#key="+token,"http://192.169.1.1/plugins/dsh-dafeiyu-room/android.html#key="+token,"http://192.168.1.256/plugins/dsh-dafeiyu-room/android.html#key="+token,"http://192.168.01.2/plugins/dsh-dafeiyu-room/android.html#key="+token,"http://127.0.0.1/plugins/dsh-dafeiyu-room/android.html#key="+token,"http://192.168.50.10:0/plugins/dsh-dafeiyu-room/android.html#key="+token,"https://example.com/not-room#key="+token,"https://example.com/plugins/dsh-dafeiyu-room/android.html?key="+token,"https://example.com/plugins/dsh-dafeiyu-room/android.html#key=short"}){
            try{RoomConnection.parse(value);throw new AssertionError("Accepted invalid pairing");}catch(IllegalArgumentException expected){}
        }
        System.out.println("Native pairing validation passed: 2 HTTPS + 4 LAN addresses; 13 invalid cases rejected.");
    }
}
