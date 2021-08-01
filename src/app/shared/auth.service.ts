import { Injectable, NgZone } from '@angular/core';
import { Observable, of, Subject, BehaviorSubject } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { switchMap, tap } from 'rxjs/operators';
import firebase from 'firebase/app';
import 'firebase/auth';
import { environment } from 'environments/environment';
import { PopupService } from 'app/shared/popup.service';

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
  googleAuth: gapi.auth2.GoogleAuth;
  private isManualLogin = false;

  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private router: Router,
    private ngZone: NgZone,
    private popupService: PopupService
  ) {
    this.user$ = afAuth.authState.pipe(
      tap(user => {
        if (user) this.updateUserData(user);
      }),
      switchMap(user => (user ? afs.doc<User>(`users/${user.uid}`).valueChanges() : of(null)))
    );

    this.user$.subscribe(
      async user => {
        if (user) {
          this.state = LoginState.LoggedIn;
          this.loggedInUserId = user.uid;
        }
      },
      err => console.error('Error', err)
    );

    this.loadGoogleAuth();
  }

  // WIP. Move this to some redirect process page
  private async processLoginManually(): Promise<void> {
    const urlParams = new URLSearchParams(location.hash);
    if (!urlParams.has('id_token')) {
      return;
    }
    this.setLoginState(LoginState.Loading);

    const credential = firebase.auth.GoogleAuthProvider.credential(urlParams.get('id_token'));

    try {
      await firebase.auth().signInWithCredential(credential);
      this.router.navigate(['/categories']);
    } catch (e) {
      console.error('Login failed');
      this.router.navigate(['/login']);
    }
  }

  private async loadGoogleAuth(): Promise<void> {
    await this.loadScript('gapi', 'https://apis.google.com/js/api:client.js');
    gapi.load('auth2', () => {
      gapi.auth2
        .init(environment.google)
        .then(auth2 => this.onGoogleInitialized(auth2))
        .catch((e: any) => {
          console.error('Error initializing google', e);
          this.onLogout();
        });
    });
  }

  private onGoogleInitialized(googleAuth: gapi.auth2.GoogleAuth): void {
    this.googleAuth = googleAuth;
    const isSignedIn = googleAuth.isSignedIn.get();
    if (isSignedIn) {
      const user = googleAuth.currentUser.get();
      this.onSignIn(user);
    } else {
      this.onLogout();
    }
  }

  onSignIn(googleUser: gapi.auth2.GoogleUser): void {
    const unsubscribe = firebase.auth().onAuthStateChanged(firebaseUser => {
      unsubscribe();
      if (this.isUserEqual(googleUser, firebaseUser)) {
        // Already logged in using the same user
        return;
      }

      // Build Firebase credential with the Google ID token.
      const credential = firebase.auth.GoogleAuthProvider.credential(googleUser.getAuthResponse().id_token);

      // Sign in with credential from the Google user.
      firebase
        .auth()
        .signInWithCredential(credential)
        .catch(error => {
          console.error('login error', error);
        });
    });
  }

  /**
   * https://firebase.google.com/docs/auth/web/google-signin#web-v8_8
   */
  isUserEqual(googleUser: gapi.auth2.GoogleUser, firebaseUser: firebase.User): boolean {
    if (firebaseUser) {
      const providerData = firebaseUser.providerData;
      for (let i = 0; i < providerData.length; i++) {
        if (
          providerData[i].providerId === firebase.auth.GoogleAuthProvider.PROVIDER_ID &&
          providerData[i].uid === googleUser.getBasicProfile().getId()
        ) {
          // We don't need to reauth the Firebase connection.
          return true;
        }
      }
    }
    return false;
  }

  async googleSignin(): Promise<void> {
    if (!this.googleAuth) {
      this.popupService
        .confirm(
          `שגיאה בהתחברות`,
          `לא ניתן להתחבר.\n
          ודאו שהדפדפן שלכם תומך בעוגיות ושאינכם במצב גלישה בסתר.\n
          לעזרה נוספת צרו קשר:\n
          rotem@ricette.co.il`,
          []
        )
        .catch(() => {
          // User dismissed the dialog (e.g., by using ESC, clicking the cross icon, or clicking outside the dialog)
        });

      console.error('Google auth not loaded. Make sure cookies are enabled');
      return;
    }
    this.setLoginState(LoginState.Loading);
    // googleAuth.grantOfflineAccess?
    await this.googleAuth.signIn({
      prompt: 'select_account'
    });
  }

  async signOut(): Promise<boolean> {
    this.logout$.next();
    this.logout$.complete();
    try {
      await Promise.all([this.googleAuth?.signOut(), this.afAuth.signOut()]);
      this.onLogout();
      return this.router.navigate(['/login']);
    } catch (e) {
      console.error('logout error', e);
    }
  }

  private onLogout(): void {
    this.setLoginState(LoginState.LoggedOut);
    this.loggedInUserId = null;
  }

  private setLoginState(state: LoginState): void {
    this.ngZone.run(() => {
      this.state = state;
    });
  }

  private async updateUserData({ uid, email }: User): Promise<void> {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(`users/${uid}`);
    const userData = await userRef.get().toPromise();
    if (!userData.exists) {
      this.newUser$.next(uid);
    }
    return userRef.set({ uid, email }, { merge: true });
  }

  private loadScript(id: string, src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');

      script.async = true;
      script.src = src;
      script.onload = (): void => {
        resolve();
      };
      script.onerror = (): void => {
        reject();
      };

      document.head.appendChild(script);
    });
  }
}
