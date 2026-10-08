// Runs after the test framework is set up, so `beforeEach` exists here.
const { resetFakeServer } = require("./__tests__/helpers/fake-api");
const { resetNotifications } = require("./__tests__/helpers/fake-notifications");
const { resetLocalAuthentication } = require("./__tests__/helpers/fake-local-authentication");
const { resetScreenCapture } = require("./__tests__/helpers/fake-screen-capture");

beforeEach(() => {
  resetFakeServer();
  resetNotifications();
  resetLocalAuthentication();
  resetScreenCapture();
});
