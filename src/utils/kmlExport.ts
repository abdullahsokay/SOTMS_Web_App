import { HistoricalGPSPoint, StopMarkerData } from '../types/tracking';

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString();
}

export function generateKML(
  vehicleId: string,
  points: HistoricalGPSPoint[],
  stops: StopMarkerData[],
  timeRange: string
): string {
  if (points.length === 0) return '';

  const coordinates = points
    .map(p => `${p.lng},${p.lat},0`)
    .join('\n          ');

  const stopPlacemarks = stops.map((stop, i) => `
    <Placemark>
      <name>Stop ${i + 1}</name>
      <description>${escapeXml(`Duration: ${Math.round(stop.duration / 60000)} min\nTime: ${formatTimestamp(stop.startTime)} - ${formatTimestamp(stop.endTime)}`)}</description>
      <Style>
        <IconStyle>
          <color>ff0000ff</color>
          <scale>0.8</scale>
          <Icon><href>http://maps.google.com/mapfiles/kml/paddle/stop.png</href></Icon>
        </IconStyle>
      </Style>
      <Point>
        <coordinates>${stop.lng},${stop.lat},0</coordinates>
      </Point>
    </Placemark>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(vehicleId)} - Path History (${escapeXml(timeRange)})</name>
    <description>GPS path history exported from SOTMS</description>
    <Style id="movingPath">
      <LineStyle><color>ff43b428</color><width>4</width></LineStyle>
    </Style>
    <Style id="startPoint">
      <IconStyle><color>ff00ff00</color><scale>1.2</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/go.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="endPoint">
      <IconStyle><color>ff0000ff</color><scale>1.2</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/stop.png</href></Icon>
      </IconStyle>
    </Style>

    <Placemark>
      <name>Traveled Path</name>
      <styleUrl>#movingPath</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
          ${coordinates}
        </coordinates>
      </LineString>
    </Placemark>

    <Placemark>
      <name>Start</name>
      <description>${escapeXml(formatTimestamp(points[0].timestamp))}</description>
      <styleUrl>#startPoint</styleUrl>
      <Point><coordinates>${points[0].lng},${points[0].lat},0</coordinates></Point>
    </Placemark>

    <Placemark>
      <name>End</name>
      <description>${escapeXml(formatTimestamp(points[points.length - 1].timestamp))}</description>
      <styleUrl>#endPoint</styleUrl>
      <Point><coordinates>${points[points.length - 1].lng},${points[points.length - 1].lat},0</coordinates></Point>
    </Placemark>
${stopPlacemarks}
  </Document>
</kml>`;
}

export function downloadKML(vehicleId: string, kmlContent: string): void {
  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${vehicleId}_path_${Date.now()}.kml`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
