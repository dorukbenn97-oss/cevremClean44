import { router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../../firebaseConfig";

export default function ProfileScreen() {
  const [appointmentCount, setAppointmentCount] = useState(0);

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      console.log("Kullanıcı bulunamadı!");
      return;
    }

    console.log("Aktif UID:", user.uid);

    const q = query(
      collection(db, "appointments"),
      where("toUserId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setAppointmentCount(snap.size);
      console.log("Gelen istek sayısı:", snap.size);
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil</Text>

      <TouchableOpacity
        style={styles.box}
        onPress={() => router.push("/randevu-talepleri")}
      >
        <View>
          <Text style={styles.boxTitle}>Randevu Talepleri 💎</Text>
          <Text style={styles.boxSubtitle}>Gelen istekleri görüntüle</Text>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{appointmentCount}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: "white",
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 30,
  },
  box: {
    backgroundColor: "#1a1a1a",
    padding: 20,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  boxTitle: {
    fontSize: 22,
    color: "white",
    fontWeight: "700",
  },
  boxSubtitle: {
    color: "#aaa",
    marginTop: 4,
  },
  badge: {
    backgroundColor: "#00C851",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
});