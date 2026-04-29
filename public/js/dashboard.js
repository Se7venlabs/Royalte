document.addEventListener("DOMContentLoaded", () => {
  const raw = localStorage.getItem("royalte_scan_data");

  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("Failed to parse scan data");
  }

  // fallback
  if (!data) {
    data = {
      artistName: "Artist",
      imageUrl: null
    };
  }

  renderIdentity(data);
});

function renderIdentity(data) {
  const nameEl = document.getElementById("hi-name");
  const imgEl = document.getElementById("hi-avatar");
  const fallbackEl = document.getElementById("hi-avatar-fallback");

  // set name
  nameEl.textContent = data.artistName || "Artist";

  // IMAGE PRIORITY (THIS WAS THE BUG)
  const imageUrl =
    data.imageUrl ||
    data.artistImageUrl ||
    data.albumImageUrl ||
    data.trackImageUrl ||
    data.artworkUrl ||
    null;

  if (imageUrl) {
    imgEl.src = imageUrl;
    imgEl.style.display = "block";
    fallbackEl.style.display = "none";
  } else {
    imgEl.style.display = "none";
    fallbackEl.style.display = "flex";
    fallbackEl.textContent = getInitials(data.artistName);
  }
}

function getInitials(name = "") {
  return name
    .split(" ")
    .map(w => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}
