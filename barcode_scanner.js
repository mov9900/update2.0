// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyA2-ZSnxGhMSbpxR9lWipQ-JX4s8Fz3j8Q",
    authDomain: "librarymanagement-80741.firebaseapp.com",
    projectId: "librarymanagement-80741",
    storageBucket: "librarymanagement-80741.firebasestorage.app",
    messagingSenderId: "7076696675",
    appId: "1:7076696675:web:ff0f1965ca544627ab1e56"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", () => {
    const barcodeModal = document.getElementById("barcodeModal");
    const overlay = document.getElementById("barcodeModalOverlay");
    const closeBtn = document.getElementById("closeBarcodeModal");
    const scannerContainer = document.getElementById("scannerContainer");

    let html5QrCode;
    let isScannerRunning = false;
    let currentUser = null;

    // ✅ Listen for login state
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
    });

    // ✅ Open scanner only if logged in
    async function openBarcodeScanner() {
        if (!currentUser) {
            window.location.href = "index.html"; // redirect to login
            return;
        }

        barcodeModal.classList.remove("hidden");

        if (!isScannerRunning) {
            html5QrCode = new Html5Qrcode("scannerContainer");
            html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                async (decodedText) => {
                    console.log("✅ Barcode Scanned:", decodedText);
                    await handleBookAction(decodedText);
                    stopBarcodeScanner();
                }
            ).then(() => { isScannerRunning = true; })
                .catch(err => console.error("Scanner start error:", err));
        }
    }

    // ✅ Stop scanner
    function stopBarcodeScanner() {
        if (html5QrCode && isScannerRunning) {
            html5QrCode.stop().then(() => {
                html5QrCode.clear();
                isScannerRunning = false;
                barcodeModal.classList.add("hidden");
            });
        } else {
            barcodeModal.classList.add("hidden");
        }
    }

    // ✅ Handle Issue / Return Logic
    async function handleBookAction(barcode) {
        try {
            const bookRef = doc(db, "books", barcode); // assuming barcode == bookId
            const bookSnap = await getDoc(bookRef);

            if (!bookSnap.exists()) {
                alert("❌ Book not found in database.");
                return;
            }

            const bookData = bookSnap.data();

            // Check if user already borrowed this book
            const borrowRef = doc(db, "borrowedBooks", `${currentUser.uid}_${barcode}`);
            const borrowSnap = await getDoc(borrowRef);

            if (borrowSnap.exists()) {
                // Already borrowed → ask for return
                if (confirm(`You already issued "${bookData.title}". Do you want to return it?`)) {
                    await setDoc(doc(db, "returnedBooks", `${currentUser.uid}_${barcode}`), {
                        userId: currentUser.uid,
                        bookId: barcode,
                        returnedAt: new Date()
                    });
                    await updateDoc(borrowRef, { returned: true });
                    alert("✅ Book returned successfully.");
                }
            } else {
                // Not borrowed → ask for issue
                if (confirm(`Do you want to issue "${bookData.title}"?`)) {
                    await setDoc(borrowRef, {
                        userId: currentUser.uid,
                        bookId: barcode,
                        issuedAt: new Date(),
                        returned: false
                    });
                    alert("✅ Book issued successfully.");
                }
            }
        } catch (err) {
            console.error("Error handling book action:", err);
            alert("⚠️ Something went wrong.");
        }
    }

    // Modal events
    overlay.addEventListener("click", stopBarcodeScanner);
    closeBtn.addEventListener("click", stopBarcodeScanner);
    document.getElementById("openScannerBtn")?.addEventListener("click", openBarcodeScanner);
});

// Adding book

document.addEventListener("DOMContentLoaded", () => {
  const addBookModal = document.getElementById("addBookModal");
  const addBookModalOverlay = document.getElementById("addBookModalOverlay");
  const closeAddBookModal = document.getElementById("closeAddBookModal");
  const cancelAddBook = document.getElementById("cancelAddBook");
  const addBookForm = addBookModal.querySelector("form");

  let currentUser = null;
  let isAdmin = false;

  // ✅ Watch auth state
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      currentUser = null;
      isAdmin = false;
    } else {
      currentUser = user;
      // 🔍 Check if user is in admins collection
      const adminRef = doc(db, "admins", user.uid);
      const adminSnap = await getDoc(adminRef);
      isAdmin = adminSnap.exists(); // true if this uid is an admin
    }
  });

  // ✅ Open modal only for admins
  document.getElementById("openAddBookBtn")?.addEventListener("click", () => {
    if (!currentUser) {
      window.location.href = "index.html"; // not logged in
      return;
    }
    if (!isAdmin) {
      alert("❌ You're not an admin!");
      return;
    }
    addBookModal.classList.remove("hidden");
  });

  // ✅ Close modal
  function closeModal() {
    addBookModal.classList.add("hidden");
    addBookForm.reset();
  }
  addBookModalOverlay.addEventListener("click", closeModal);
  closeAddBookModal.addEventListener("click", closeModal);
  cancelAddBook.addEventListener("click", closeModal);

  // ✅ Handle Add Book (only if admin)
  addBookForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentUser) {
      window.location.href = "index.html";
      return;
    }
    if (!isAdmin) {
      alert("❌ You're not an admin!");
      return;
    }

    // Grab values
    const title = addBookForm.querySelector('input[placeholder="Enter book title"]').value.trim();
    const author = addBookForm.querySelector('input[placeholder="Enter author name"]').value.trim();
    const isbn = addBookForm.querySelector('input[placeholder="Enter ISBN"]').value.trim();
    const genre = addBookForm.querySelector("select").value;
    const description = addBookForm.querySelector("textarea").value.trim();

    if (!isbn) {
      alert("❌ ISBN is required.");
      return;
    }

    try {
      // ✅ Save book using ISBN as document ID
      await setDoc(doc(db, "books", isbn), {
        title,
        author,
        isbn,
        genre,
        description,
        createdAt: new Date()
      });

      alert("✅ Book added successfully!");
      closeModal();
    } catch (err) {
      console.error("Error adding book:", err);
      alert("⚠️ Failed to add book.");
    }
  });
});
// document.addEventListener("DOMContentLoaded", () => {
//     const addBookModal = document.getElementById("addBookModal");
//     const addBookModalOverlay = document.getElementById("addBookModalOverlay");
//     const closeAddBookModal = document.getElementById("closeAddBookModal");
//     const cancelAddBook = document.getElementById("cancelAddBook");
//     const addBookForm = addBookModal.querySelector("form");

//     // ✅ Open modal (example button with id="openAddBookBtn")
//     document.getElementById("openAddBookBtn")?.addEventListener("click", () => {
//         addBookModal.classList.remove("hidden");
//     });

//     // ✅ Close modal
//     function closeModal() {
//         addBookModal.classList.add("hidden");
//         addBookForm.reset();
//     }
//     addBookModalOverlay.addEventListener("click", closeModal);
//     closeAddBookModal.addEventListener("click", closeModal);
//     cancelAddBook.addEventListener("click", closeModal);

//     // ✅ Handle Add Book
//     addBookForm.addEventListener("submit", async (e) => {
//         e.preventDefault();

//         // Grab values
//         const title = addBookForm.querySelector('input[placeholder="Enter book title"]').value.trim();
//         const author = addBookForm.querySelector('input[placeholder="Enter author name"]').value.trim();
//         const isbn = addBookForm.querySelector('input[placeholder="Enter ISBN"]').value.trim();
//         const genre = addBookForm.querySelector("select").value;
//         const description = addBookForm.querySelector("textarea").value.trim();

//         if (!isbn) {
//             alert("❌ ISBN is required.");
//             return;
//         }

//         try {
//             // ✅ Save book using ISBN as document ID
//             await setDoc(doc(db, "books", isbn), {
//                 title,
//                 author,
//                 isbn,
//                 genre,
//                 description,
//             });

//             alert("✅ Book added successfully!");
//             closeModal();
//         } catch (err) {
//             console.error("Error adding book:", err);
//             alert("⚠️ Failed to add book.");
//         }
   
//     });
// });
// // --- Modal and Scanner UI elements ---
// const barcodeModal = document.getElementById('barcodeModal');
// const closeBarcodeBtn = document.getElementById('closeBarcodeModal');
// const scannerContainer = document.getElementById('scannerContainer');
// let scanner = null; // For barcode scanner instance

// function openBarcodeModal() {
//     // Check Auth
//     const user = auth.currentUser;
//     if (!user) {
//         alert('Error: You must be logged in to access the scanner.');
//         window.location.href = 'index.html'; // Set your login route/path
//         return;
//     }
//     barcodeModal.classList.remove('hidden');
//     startScanner();
// }

// function closeBarcodeModal() {
//     barcodeModal.classList.add('hidden');
//     stopScanner();
// }

// // EVENT: Optionally listen for login state changes and conditionally show/hide modal as needed
// onAuthStateChanged(auth, (user) => {
//     // If user is not logged in, close modal (optional).
//     if (!user && !barcodeModal.classList.contains('hidden')) {
//         closeBarcodeModal();
//         alert('Session expired or logged out. Please login to use scanner.');
//         window.location.href = 'index.html';
//     }
// });

// function startScanner() {
//     // Replace with your scanner logic, e.g. html5-qrcode, etc.
//     scannerContainer.innerHTML = '<span class="text-gray-700">[Scanner running, camera active]</span>';
// }
// function stopScanner() {
//     scannerContainer.innerHTML = '';
// }

// // Event listeners
// closeBarcodeBtn.addEventListener('click', closeBarcodeModal);
// document.getElementById('openBarcodeModalBtn')?.addEventListener('click', openBarcodeModal);
// document.getElementById('barcodeModalOverlay').addEventListener('click', closeBarcodeModal);

// // Optionally, redirect user on page load if not logged in
// window.addEventListener('DOMContentLoaded', () => {
//     if (!auth.currentUser) { // On first load, this may be null even for logged-in users; prefer onAuthStateChanged for real-time.
//         alert('You must be logged in to access the scanner.');
//         window.location.href = 'index.html';
//     }
// });