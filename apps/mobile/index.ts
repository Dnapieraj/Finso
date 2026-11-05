// The app entry: Expo Router, plus the home screen widget's headless task
// (Android), which must be registered before any widget asks for an update.
import "expo-router/entry";

import { Platform } from "react-native";
import { registerWidgetTaskHandler } from "react-native-android-widget";

import { widgetTaskHandler } from "./src/widget/update";

if (Platform.OS === "android") registerWidgetTaskHandler(widgetTaskHandler);
