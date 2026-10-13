// Runs after the test framework is set up, so `beforeEach` exists here.
const { resetFakeServer } = require("./__tests__/helpers/fake-api");
const { resetNotifications } = require("./__tests__/helpers/fake-notifications");
const { resetLocalAuthentication } = require("./__tests__/helpers/fake-local-authentication");
const { resetScreenCapture } = require("./__tests__/helpers/fake-screen-capture");
const { resetHaptics } = require("./__tests__/helpers/fake-haptics");
const { resetNetInfo } = require("./__tests__/helpers/fake-netinfo");

beforeEach(() => {
  resetFakeServer();
  resetNotifications();
  resetLocalAuthentication();
  resetScreenCapture();
  resetHaptics();
  resetNetInfo();
});
