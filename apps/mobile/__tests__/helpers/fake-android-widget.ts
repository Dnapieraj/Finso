/**
 * Stand-in for react-native-android-widget, mocked globally in jest.setup.js:
 * there is no launcher under Jest. Widget components render nothing.
 */
export const FlexWidget = () => null;
export const TextWidget = () => null;
export const requestWidgetUpdate = jest.fn(() => Promise.resolve());
export const registerWidgetTaskHandler = jest.fn();
