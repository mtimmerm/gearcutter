# GearCutter
This little web page uses a unique method to generate SVG gear shapes that you can import into a CAD program for
cutting gears with CNC.

 1. The gear parameters are used to create the shape of a rack;
 2. The curve that each line or corner of the rack would cut into the gear, as they move together,
    is determined exactly, to the limits of floating point precision;
 3. The shape of the gear is determined to be the lower envelope, in polar coordinates from the
    gear center, of all these cuts.  This is again determined exactly to the limits of floating point
    precision; Then, finally
 4. Each curve in the gear shape is approximated with circular arcs, to the required tolerance.
    Circular arcs are used, because they are directly supported by all CNC machines, and will not need
    to be approximated again.  Separate tolerance values are specified for the tooth faces
    (critically important) and the fillets (not so important when clearance is used).

You can use it online here: https://mtimmerm.github.io/webStuff/gearcutter.html
