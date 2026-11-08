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

test("Faculty Auth: SignUp returns credentialSync and survives cold start", async () => {
  const facultyEmail = `test.prof.${Math.floor(100 + Math.random() * 899)}@cuiatk.edu.pk`;

  // 1. Initial sign in without account fails
  const failedLogin = await serverFacultySignIn(facultyEmail, "WrongPass123!");
  assert.equal(failedLogin.success, false);
  assert.equal(failedLogin.error, "Invalid email or password.");

  // 2. Mock a valid client vault account
  // In reality, this was stored in localStorage on account creation
  const mockSalt = "1234567890abcdef";
  // PBKDF2 hash of "FacultySecret123!" using crypto
  const crypto = await import("node:crypto");
  const mockHash = crypto.pbkdf2Sync("FacultySecret123!", mockSalt, 210000, 64, "sha512").toString("hex");

  const facultyVault = {
    email: facultyEmail,
    fullName: "Dr. Test Professor",
    teacherId: 101,
    timetableName: "Dr. Test Prof",
    department: "Department of Computer Science",
    passwordHash: mockHash,
    passwordSalt: mockSalt,
    notificationLeadMins: 10,
  };

  // 3. Wrong password with vault fails
  const failedVault = await serverFacultySignIn(facultyEmail, "IncorrectPass!", facultyVault);
  assert.equal(failedVault.success, false);
  assert.equal(failedVault.error, "Invalid email or password.");

  // 4. Correct password with vault succeeds, re-hydrates record and returns fresh credentialSync
  const successVault = await serverFacultySignIn(facultyEmail, "FacultySecret123!", facultyVault);
  assert.equal(successVault.success, true);
  assert.ok(successVault.session);
  assert.equal(successVault.session.profile.email, facultyEmail);
  assert.equal(successVault.session.profile.fullName, "Dr. Test Professor");
  assert.ok(successVault.credentialSync);
  assert.equal(successVault.credentialSync.email, facultyEmail);

  // 5. Subsequent sign-in without vault succeeds because it is now re-hydrated in memory and DB
  const reLogin = await serverFacultySignIn(facultyEmail, "FacultySecret123!");
  assert.equal(reLogin.success, true);
  assert.ok(reLogin.session);
});
