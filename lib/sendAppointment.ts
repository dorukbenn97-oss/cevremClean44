import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export default async function sendAppointment(toUser: string, message: string) {
  const current = auth.currentUser;

  if (!current) return false;

  try {
    await addDoc(collection(db, "appointments"), {
      fromUser: current.uid,
      toUser: toUser,   // ✔ ProfileScreen ile uyumlu
      message,
      status: "pending",
      createdAt: serverTimestamp()
    });

    return true;
  } catch (err) {
    console.log("Randevu gönderme hatası:", err);
    return false;
  }
}