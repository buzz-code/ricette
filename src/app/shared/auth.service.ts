import { Injectable } from '@angular/core';
import { Observable, of, Subject, BehaviorSubject } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { switchMap, tap } from 'rxjs/operators';
import firebase from 'firebase/app';
import 'firebase/auth';

interface User {
  uid: string;
  email: string;
}

export enum LoginState {
  Loading,
  LoggedIn,
  LoggedOut
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user$: Observable<User>;
  logout$ = new Subject();
  newUser$ = new BehaviorSubject(null);
  loggedInUserId: string;
  state: LoginState = LoginState.Loading;

  errorCode2String: object = {
    'auth/invalid-email': 'האימייל לא תקין',
    'auth/user-disabled': 'אימייל או סיסמה לא נכונים',
    'auth/user-not-found': 'אימייל או סיסמה לא נכונים',
    'auth/wrong-password': 'אימייל או סיסמה לא נכונים',
    'auth/email-already-in-use': 'אימייל כבר קיים במערכת',
    'auth/operation-not-allowed': 'הפעולה נכשלה (1). נסו שוב או צרו קשר',
    'auth/weak-password': 'הסיסמה לא חזקה מספיק',
    'auth/missing-android-pkg-name': 'הפעולה נכשלה (2). נסו שוב או צרו קשר',
    'auth/missing-continue-uri': 'הפעולה נכשלה (3). נסו שוב או צרו קשר',
    'auth/missing-ios-bundle-id': 'הפעולה נכשלה (4). נסו שוב או צרו קשר',
    'auth/invalid-continue-uri': 'הפעולה (5). נסו שוב או צרו קשר',
    'auth/unauthorized-continue-uri': 'הפעולה נכשלה (6). נסו שוב או צרו קשר',
  };

  constructor(private afAuth: AngularFireAuth, private afs: AngularFirestore, private router: Router) {
    this.user$ = afAuth.authState.pipe(
      tap(user => {
        if (user) this.updateUserData(user);
      }),
      switchMap(user => (user ? afs.doc<User>(`users/${user.uid}`).valueChanges() : of(null)))
    );

    this.afAuth.getRedirectResult().catch(e => console.error(e));
    this.user$.subscribe(async user => {
      this.state = user ? LoginState.LoggedIn : LoginState.LoggedOut;
      this.loggedInUserId = user ? user.uid : null;
    });
  }

  async googleSignin(): Promise<void> {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    this.state = LoginState.Loading;
    await this.afAuth.signInWithRedirect(provider);
  }

  async signOut(): Promise<boolean> {
    this.logout$.next();
    this.logout$.complete();
    await this.afAuth.signOut();
    return this.router.navigate(['/login']);
  }

  async emailSignIn(email: string, pass: string): Promise<void> {
    try {
      await firebase.auth().signInWithEmailAndPassword(email, pass);
    } catch (error) {
      throw new Error(this.errorCode2String[error.code]);
    }
  }

  async emailSignup(email: string, pass: string): Promise<void> {
    try {
      await firebase.auth().createUserWithEmailAndPassword(email, pass);
    } catch (error) {
      throw new Error(this.errorCode2String[error.code]);
    }
  }

  async emailReset(email: string): Promise<void> {
    console.log(email);
  }

  private async updateUserData({ uid, email }: User): Promise<void> {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(`users/${uid}`);
    const userData = await userRef.get().toPromise();
    if (!userData.exists) {
      this.newUser$.next(uid);
    }
    return userRef.set({ uid, email }, { merge: true });
  }
}
