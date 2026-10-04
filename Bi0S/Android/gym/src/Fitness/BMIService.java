package Fitness;
class BMIService {

    public static double calculateBMI(double weight, double height)
            throws InvalidHealthDataException {

        if (weight <= 0 || height <= 0) {
            throw new InvalidHealthDataException("Invalid height or weight!");
        }

        return weight / (height * height);
    }
}