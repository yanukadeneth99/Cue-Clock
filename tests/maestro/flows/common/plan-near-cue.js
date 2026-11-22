// Works out which arrows to tap so a new cue lands about 2 minutes from now.
// A new cue starts at the next full hour. Zone 1 is Berlin, whose minutes match UTC minutes.
var target = new Date().getUTCMinutes() + 2;
// How far the target is from the next full hour, in minutes (from -58 to +1).
var delta = target - 60;
if (delta < -30) {
  // Closer to the start of this hour: step the hour back once, then add minutes.
  output.hourDown = true;
  output.upTaps = target;
  output.downTaps = 0;
} else if (delta <= 0) {
  // Closer to the next hour: take minutes off the default time.
  output.hourDown = false;
  output.upTaps = 0;
  output.downTaps = -delta;
} else {
  // Just past the hour turn: add a minute to the default time.
  output.hourDown = false;
  output.upTaps = delta;
  output.downTaps = 0;
}
