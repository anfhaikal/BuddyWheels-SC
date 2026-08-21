"use client";
import { useEffect, useState } from "react";

interface Profile {
  id: number;
  url: string;
  found: boolean | null;
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    const start = 40000;
    const end = 40500;

    const temp: Profile[] = [];

    for (let id = start; id <= end; id++) {
      const url = `https://italeemc.iium.edu.my/pluginfile.php/${id}/user/icon/remui/f3?rev=334850`;
      temp.push({ id, url, found: null });
    }
    {
      /* https://italeemc.iium.edu.my/pluginfile.php/40490/user/icon/remui/f3?rev=334850*/
    }

    setProfiles(temp);
  }, []);

  const handleLoad = (id: number) => {
    setProfiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, found: true } : item))
    );
  };

  const handleError = (id: number) => {
    setProfiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, found: false } : item))
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>IIUM Profile Pictures (92900 - 92999)</h1>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {profiles.map((prof) => (
          <div key={prof.id} style={{ textAlign: "center" }}>
            {prof.found === false ? (
              <div
                style={{
                  width: 80,
                  height: 80,
                  border: "1px solid gray",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: 12,
                }}
              >
                Not found
              </div>
            ) : (
              <img
                src={prof.url}
                alt="profile"
                width={80}
                height={80}
                onLoad={() => handleLoad(prof.id)}
                onError={() => handleError(prof.id)}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            )}

            <div>ID: {prof.id}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
