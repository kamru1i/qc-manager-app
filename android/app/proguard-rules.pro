# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ── QC Manager release-shrinking rules (minifyEnabled true) ─────────────
# Capacitor core already ships consumer rules that keep every
# @CapacitorPlugin-annotated class and Plugin subclass, so the installed
# plugins (app, filesystem, share, keyboard, status-bar, file-opener) are
# safe. The rules below are the app-side complement.

# Keep readable stack traces in release crash logs.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Cordova compatibility layer used by capacitor-cordova-android-plugins.
-keep public class * extends org.apache.cordova.CordovaPlugin {
  public <methods>;
  public <fields>;
}

# Defensive: some Capacitor plugins reflect over their own config/annotation
# classes; keep annotation metadata R8 might otherwise strip.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
