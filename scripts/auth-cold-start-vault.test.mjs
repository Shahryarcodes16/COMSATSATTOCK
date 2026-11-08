import test from "node:test";
import assert from "node:assert/strict";
import {
  serverStudentSignUp,
  serverStudentSignIn,
  serverVerifyCodeAndSignUp,
} from "../src/lib/student.server.ts";
import {
  serverVerifyFacultyCodeAndSignUp,
  serverFacultySignIn,
} from "../src/lib/faculty.server.ts";

test("Student Auth: SignUp returns credentialSync for client local vault", async () => {
  const testEmail = `sp24-bcs-${Math.floor(100 + Math.random() * 899)}@cuiatk.edu.pk`;
  const res = await serverStudentSignUp(testEmail, "Ali Ahmed", "SecurePassword123!");
  if (!res.success) {
    console.error("SignUp error:", res.error);
  }
  assert.equal(res.success, true);
  assert.ok(res.session);
  assert.ok(res.credentialSync);
  assert.equal(res.credentialSync.email, testEmail);
  assert.equal(res.credentialSync.fullName, "Ali Ahmed");
  assert.ok(res.credentialSync.passwordHash);
  assert.ok(res.credentialSync.passwordSalt);
});

test("Student Auth: Resilient Cold-Start Login using Client Vault", async () => {
  const testEmail = `fa23-bse-${Math.floor(100 + Math.random() * 899)}@cuiatk.edu.pk`;
  
  // 1. Initial sign up
  const signUpRes = await serverStudentSignUp(testEmail, "Fatima Khan", "Password789!");
  if (!signUpRes.success) {
    console.error("SignUp error:", signUpRes.error);
  }
  assert.equal(signUpRes.success, true);
  const vaultAccount = signUpRes.credentialSync;
  assert.ok(vaultAccount);

  // 2. Normal login succeeds
  const normalLogin = await serverStudentSignIn(testEmail, "Password789!");
  assert.equal(normalLogin.success, true);

  // 3. Test cold container login with vault
  const coldEmail = `fa22-bcs-${Math.floor(100 + Math.random() * 899)}@cuiatk.edu.pk`;
  const tempSignUp = await serverStudentSignUp(coldEmail, "Zain Malik", "ZainSecret999!");
  const coldVault = tempSignUp.credentialSync;

  // Login with invalid password fails even with vault
  const failedVaultLogin = await serverStudentSignIn(coldEmail, "WrongPassword!", coldVault);
  assert.equal(failedVaultLogin.success, false);
  assert.equal(failedVaultLogin.error, "Invalid email or password.");

  // Login with correct password and vault succeeds and returns fresh session + credentialSync
  const successVaultLogin = await serverStudentSignIn(coldEmail, "ZainSecret999!", coldVault);
  assert.equal(successVaultLogin.success, true);
  assert.ok(successVaultLogin.session);
  assert.equal(successVaultLogin.session.profile.email, coldEmail);
  assert.equal(successVaultLogin.session.profile.fullName, "Zain Malik");
  assert.ok(successVaultLogin.credentialSync);
});

test("Cross-Device Auth: Account created on Mobile can log in on Laptop with password only", async () => {
  // 1. Student registers on Mobile
  const studentMobileEmail = `fa24-bcs-${Math.floor(100 + Math.random() * 899)}@cuiatk.edu.pk`;
  const studentPass = "MobileCreatedPassword456!";
  const studentSignup = await serverStudentSignUp(studentMobileEmail, "Hamza Tariq", studentPass);
  assert.equal(studentSignup.success, true);

  // 2. Student opens Laptop (no vault, no localStorage from mobile) and signs in with password
  const studentLaptopLogin = await serverStudentSignIn(studentMobileEmail, studentPass);
  assert.equal(studentLaptopLogin.success, true);
  assert.ok(studentLaptopLogin.session);
  assert.equal(studentLaptopLogin.session.profile.email, studentMobileEmail);
  assert.equal(studentLaptopLogin.session.profile.fullName, "Hamza Tariq");
  assert.ok(studentLaptopLogin.credentialSync);

  // 3. Laptop login with wrong password fails strictly
  const studentWrongPass = await serverStudentSignIn(studentMobileEmail, "WrongPasswordHere!");
  assert.equal(studentWrongPass.success, false);
  assert.equal(studentWrongPass.error, "Invalid email or password.");
});

test("Cross-Device Faculty Auth: Faculty account created on Mobile logs in on Desktop", async () => {
  const facultyEmail = `prof.mobile.${Math.floor(100 + Math.random() * 899)}@cuiatk.edu.pk`;
  const facultyPass = "ProfSecretDesktop999!";

  // 1. Mock faculty account creation on Mobile
  const crypto = await import("node:crypto");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(facultyPass, salt, 210000, 64, "sha512").toString("hex");

  // Re-hydrate through vault to seed the database
  const mobileVault = {
    email: facultyEmail,
    fullName: "Dr. Mobile Registered",
    teacherId: 202,
    department: "Department of Computer Science",
    passwordHash: hash,
    passwordSalt: salt,
    notificationLeadMins: 10,
  };
  const seed = await serverFacultySignIn(facultyEmail, facultyPass, mobileVault);
  assert.equal(seed.success, true);

  // 2. Faculty opens Desktop (no client vault passed) and logs in with password only
  const desktopLogin = await serverFacultySignIn(facultyEmail, facultyPass);
  assert.equal(desktopLogin.success, true);
  assert.ok(desktopLogin.session);
  assert.equal(desktopLogin.session.profile.email, facultyEmail);
  assert.equal(desktopLogin.session.profile.fullName, "Dr. Mobile Registered");

  // 3. Desktop login with wrong password fails
  const wrongDesktop = await serverFacultySignIn(facultyEmail, "WrongPass999!");
  assert.equal(wrongDesktop.success, false);
});
